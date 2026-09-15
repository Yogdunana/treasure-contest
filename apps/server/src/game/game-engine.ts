import type { GamePhase, FinalResult } from '@treasure-contest/shared';
import {
  MIN_PLAYERS,
  TIMING_CONFIG,
  TOTAL_ROUNDS,
} from '@treasure-contest/shared';
import * as stateMachine from './state-machine.js';
import type { StateResult } from './state-machine.js';
import { TimerManager } from './timer-manager.js';
import { HistoryLogger } from './history.js';
import type { Room } from './room.js';
import * as roomRepo from '../db/repositories/room-repo.js';
import * as playerRepo from '../db/repositories/player-repo.js';
import * as gemRepo from '../db/repositories/gem-repo.js';
import { generateAuthToken } from '../identity/auth-token.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// GameEngine
// ============================================================================

/**
 * The main game orchestrator.
 *
 * Combines the pure state machine with the timer manager, DB persistence,
 * and broadcasting. Each public method corresponds to a game action or
 * phase transition and follows this pattern:
 *
 * 1. Call the appropriate state machine function (validation + state mutation)
 * 2. Sync the updated state to SQLite
 * 3. Broadcast the new state to all connected clients
 * 4. Start any timers needed for the next phase
 *
 * The broadcastFn callback is provided externally (typically by the
 * socket.io layer) and handles sending role-filtered snapshots to each
 * connected client.
 */
export class GameEngine {
  private history: HistoryLogger;

  constructor(
    private room: Room,
    private timerManager: TimerManager,
    private broadcastFn: (room: Room) => void,
  ) {
    this.history = new HistoryLogger(room);
  }

  // ========================================================================
  // Game flow methods
  // ========================================================================

  /**
   * Start the game: LOBBY -> GAME_INIT.
   *
   * Validates minimum players, deals missions, then immediately
   * proceeds to the first round.
   */
  startGame(): void {
    // Only drop ghosts when the game can actually start — a premature
    // startGame must not wipe same-name reclaimable lobby seats.
    if (this.room.getConnectedPlayers().length >= MIN_PLAYERS) {
      this.dropOfflineSeats();
    }

    const result = stateMachine.startGame(this.room);
    if (!result.success) {
      logger.warn('startGame failed', { error: result.error, room: this.room.code });
      this.syncToDB();
      this.broadcast();
      return;
    }

    this.logEvent('game_start');
    this.syncToDB();
    this.broadcast();

    // Immediately proceed to first round
    this.startRound();
  }

  /**
   * Start a new round: generate gems, transition to ROUND_START.
   * Then auto-transition through GEM_REVEAL to NUMBER_SELECTION.
   */
  startRound(): void {
    stateMachine.startRound(this.room);
    this.logEvent('round_start', this.room.currentRound);
    this.syncGems();
    this.syncToDB();
    this.broadcast();

    // ROUND_START -> GEM_REVEAL (brief, then show gems)
    stateMachine.revealGems(this.room);
    this.syncToDB();
    this.broadcast();

    // After GEM_REVEAL_DELAY_MS, transition to NUMBER_SELECTION
    this.timerManager.startPausableDelay(
      this.room,
      'gem_reveal',
      TIMING_CONFIG.GEM_REVEAL_DELAY_MS,
      () => {
        this.startNumberSelectionPhase();
      },
    );
  }

  /**
   * Transition to NUMBER_SELECTION and start the 15-second countdown.
   */
  private startNumberSelectionPhase(): void {
    stateMachine.startNumberSelection(this.room);
    this.syncToDB();
    this.broadcast();

    this.timerManager.startNumberSelection(
      this.room,
      (remaining) => {
        // onTick: broadcast timer state
        this.broadcast();
      },
      () => {
        // onExpire: auto-reveal numbers
        logger.info('Number selection timer expired', {
          room: this.room.code,
          round: this.room.currentRound,
        });
        this.revealNumbers();
      },
    );
  }

  /**
   * Handle a player's number submission.
   * If all connected players have submitted, auto-proceeds to NUMBER_REVEAL.
   */
  onNumberSubmitted(playerId: string, number: number): StateResult {
    const result = stateMachine.submitNumber(this.room, playerId, number);
    if (!result.success) {
      return result;
    }

    this.logEvent('number_submitted', this.room.currentRound, undefined, playerId, { number });
    this.syncPlayerState(playerId);
    this.syncToDB();
    this.broadcast();

    // Check if all players have submitted
    if (stateMachine.checkAllSubmitted(this.room)) {
      // Clear the number selection timer
      this.timerManager.clear('number_selection');
      this.revealNumbers();
    }

    return { success: true };
  }

  /**
   * Check if all connected players have submitted and proceed if so.
   */
  checkAllSubmittedAndProceed(): void {
    if (stateMachine.checkAllSubmitted(this.room)) {
      this.timerManager.clear('number_selection');
      this.revealNumbers();
    }
  }

  /**
   * Transition NUMBER_SELECTION -> NUMBER_REVEAL.
   * Shows all submitted numbers, then after a delay proceeds to order calculation.
   */
  revealNumbers(): void {
    stateMachine.revealNumbers(this.room);
    this.logEvent('numbers_revealed', this.room.currentRound);
    this.syncToDB();
    this.broadcast();

    // After NUMBER_REVEAL_DELAY_MS, proceed to order calculation
    this.timerManager.startPausableDelay(
      this.room,
      'number_reveal',
      TIMING_CONFIG.NUMBER_REVEAL_DELAY_MS,
      () => {
        this.calculateOrder();
      },
    );
  }

  /**
   * Calculate selection order: NUMBER_REVEAL -> ORDER_CALCULATION.
   * After a delay, proceeds to gem selection.
   */
  calculateOrder(): void {
    stateMachine.calculateSelectionOrder(this.room);
    this.logEvent('order_calculated', this.room.currentRound, undefined, undefined, {
      selectionOrder: this.room.selectionOrder,
      collisionGroups: this.room.collisionGroups,
      voidedNumbers: this.room.voidedNumbers,
    });
    this.syncToDB();
    this.broadcast();

    // After ORDER_CALC_DELAY_MS, proceed to gem selection
    this.timerManager.startPausableDelay(
      this.room,
      'order_calc',
      TIMING_CONFIG.ORDER_CALC_DELAY_MS,
      () => {
        this.startGemSelection();
      },
    );
  }

  /**
   * Transition to GEM_SELECTION and start the first picker's countdown.
   */
  startGemSelection(): void {
    stateMachine.startGemSelection(this.room);
    this.logEvent('gem_selection_start', this.room.currentRound);
    this.syncToDB();
    this.broadcast();

    // Start first picker's timer (or end round if no pickers)
    this.startCurrentPickerTimer();
  }

  /**
   * Handle a player's gem selection.
   * Clears the current picker's timer and advances to the next picker.
   */
  onGemSelected(playerId: string, gemId: string): StateResult {
    const result = stateMachine.selectGem(this.room, playerId, gemId);
    if (!result.success) {
      return result;
    }

    // Find the picked gem for logging
    const gem = this.room.currentGems.find((g) => g.id === gemId);
    this.logEvent('gem_selected', this.room.currentRound, undefined, playerId, {
      gemId,
      color: gem?.color,
      value: gem?.value,
    });

    // Sync gem pick to DB
    if (gem?.pickedBy && gem?.pickOrder !== undefined) {
      this.syncGemPick(gemId, gem.pickedBy, gem.pickOrder);
    }
    this.syncPlayerState(playerId);
    this.syncToDB();
    this.broadcast();

    // Clear current picker's timer
    this.timerManager.clear(`gem_pick_${playerId}`);

    // Advance to next picker
    this.advanceToNextPicker();

    return { success: true };
  }

  /**
   * Handle gem pick timeout: auto-skip the player.
   */
  onGemPickTimeout(playerId: string): void {
    this.timerManager.clear(`gem_pick_${playerId}`);
    if (this.room.getCurrentPickerId() !== playerId) {
      return;
    }

    logger.info('Gem pick timeout', {
      room: this.room.code,
      round: this.room.currentRound,
      playerId,
    });

    this.logEvent('gem_pick_timeout', this.room.currentRound, undefined, playerId);
    this.broadcast();

    // Advance to next picker (player doesn't get a gem)
    this.advanceToNextPicker();
  }

  /**
   * Advance to the next picker or end the round if all pickers are done
   * or all gems have been picked.
   */
  advanceToNextPicker(): void {
    stateMachine.advancePicker(this.room);

    // Check if round should end
    const noMorePickers = !this.room.hasRemainingPickers();
    const allGemsPicked = this.room.allGemsPicked();

    if (noMorePickers || allGemsPicked) {
      this.endRound();
    } else {
      this.syncToDB();
      this.broadcast();
      this.startCurrentPickerTimer();
    }
  }

  /**
   * End the round: record history, transition to ROUND_END.
   * After a delay, starts the next round or final calculation.
   */
  endRound(): void {
    stateMachine.endRound(this.room);
    this.logEvent('round_end', this.room.currentRound, undefined, undefined, {
      gemResults: this.room.roundHistory[this.room.roundHistory.length - 1]?.gemResults,
    });
    this.syncToDB();
    this.broadcast();

    // After ROUND_END_DELAY_MS, proceed to next round or final calculation
    this.timerManager.startPausableDelay(
      this.room,
      'round_end',
      TIMING_CONFIG.ROUND_END_DELAY_MS,
      () => {
        if (this.room.currentRound >= TOTAL_ROUNDS) {
          this.calculateFinalScores();
        } else {
          this.startRound();
        }
      },
    );
  }

  /**
   * Calculate final scores: transition to FINAL_CALCULATION.
   * Checks missions, assigns ranks, generates final results.
   * Then transitions to RESULTS_REVEAL for progressive reveal.
   */
  calculateFinalScores(): void {
    stateMachine.calculateFinalScores(this.room);
    this.logEvent('final_calculation', undefined, undefined, undefined, {
      finalResults: this.room.finalResults.map((r) => ({
        playerId: r.playerId,
        name: r.name,
        finalScore: r.finalScore,
        finalRank: r.finalRank,
      })),
    });

    // Log per-player final results and mission results
    for (const result of this.room.finalResults) {
      this.logEvent('final_result', undefined, undefined, result.playerId, {
        name: result.name,
        finalScore: result.finalScore,
        finalRank: result.finalRank,
        baseScore: result.baseScore,
        colorBonus: result.colorBonus,
        missionBonus: result.missionBonus,
      });
      for (const mission of result.missions) {
        this.logEvent('mission_result', undefined, undefined, result.playerId, {
          missionId: mission.missionId,
          difficulty: mission.difficulty,
          reward: mission.reward,
          completed: mission.completed,
        });
      }
    }

    this.syncToDB();
    this.persistAllPlayerScores();
    this.broadcast();

    // Transition to RESULTS_REVEAL
    this.room.phase = 'RESULTS_REVEAL';
    this.room.revealedResultsCount = 0;
    this.syncToDB();
    this.broadcast();

    // Reveal results from lowest score to highest score (worst to best)
    const sortedResults = [...this.room.finalResults].sort(
      (a, b) => a.finalScore - b.finalScore,
    );

    sortedResults.forEach((result, index) => {
      this.timerManager.startDelay(
        `reveal_${index}`,
        (index + 1) * TIMING_CONFIG.FINAL_REVEAL_INTERVAL_MS,
        () => {
          this.room.revealedResultsCount++;
          this.logEvent('result_revealed', undefined, undefined, result.playerId, {
            rank: result.finalRank,
            score: result.finalScore,
          });
          this.broadcast();
        },
      );
    });

    // After all reveals, transition to GAME_OVER
    const totalRevealTime =
      (sortedResults.length + 1) * TIMING_CONFIG.FINAL_REVEAL_INTERVAL_MS;
    this.timerManager.startDelay('game_over', totalRevealTime, () => {
      this.room.phase = 'GAME_OVER';
      this.room.revealedResultsCount = this.room.finalResults.length;
      this.logEvent('game_end');
      this.syncToDB();
      this.broadcast();
    });
  }

  /**
   * Restart the game: reset room state, increment gameSession.
   */
  restartGame(): void {
    this.timerManager.clearAll();
    stateMachine.restartGame(this.room);
    // Keep host/screen socket attachments. Drop offline seats so the next
    // lobby is joinable — leftover disconnected rows would fill capacity
    // and push new names into the queue.
    this.dropOfflineSeats();

    // gameSession bumped → old Layer-1 tokens are invalid. Mint new ones
    // for remaining (connected) players and persist the reset player state
    // so a process restart does not restore gems/missions from last game.
    this.room.playerAuthTokens.clear();
    for (const player of this.room.players.values()) {
      const authToken = generateAuthToken(
        player.id,
        this.room.code,
        this.room.gameSession,
      );
      this.room.playerAuthTokens.set(player.id, authToken);
      try {
        playerRepo.updateAuthToken(player.id, authToken);
      } catch (err) {
        logger.error('Failed to rotate auth token on restart', {
          error: err instanceof Error ? err.message : err,
          room: this.room.code,
          playerId: player.id,
        });
      }
      this.syncPlayerState(player.id);
    }
    try {
      gemRepo.deleteGemsByRoom(this.room.code);
    } catch (err) {
      logger.error('Failed to clear gem rows on restart', {
        error: err instanceof Error ? err.message : err,
        room: this.room.code,
      });
    }

    this.logEvent('game_restart');
    this.syncToDB();
    this.broadcast();
    logger.info('Game restarted', {
      room: this.room.code,
      session: this.room.gameSession,
      players: this.room.players.size,
      screenAttached: Boolean(this.room.screenSocketId),
      hostAttached: Boolean(this.room.hostSocketId),
    });
  }

  /**
   * Host ended the game: score immediately if needed and jump to GAME_OVER
   * without waiting for the reveal ceremony.
   */
  endGameNow(): void {
    this.timerManager.clearAll();
    if (this.room.finalResults.length === 0) {
      stateMachine.calculateFinalScores(this.room);
      this.logEvent('final_calculation', undefined, undefined, undefined, {
        finalResults: this.room.finalResults.map((r) => ({
          playerId: r.playerId,
          name: r.name,
          finalScore: r.finalScore,
          finalRank: r.finalRank,
        })),
      });
      for (const result of this.room.finalResults) {
        this.logEvent('final_result', undefined, undefined, result.playerId, {
          name: result.name,
          finalScore: result.finalScore,
          finalRank: result.finalRank,
          baseScore: result.baseScore,
          colorBonus: result.colorBonus,
          missionBonus: result.missionBonus,
        });
        for (const mission of result.missions) {
          this.logEvent('mission_result', undefined, undefined, result.playerId, {
            missionId: mission.missionId,
            difficulty: mission.difficulty,
            reward: mission.reward,
            completed: mission.completed,
          });
        }
      }
      this.persistAllPlayerScores();
    }

    this.room.phase = 'GAME_OVER';
    this.room.isPaused = false;
    this.room.pausedPhase = null;
    this.room.timerRemaining = 0;
    this.room.timerDeadline = null;
    this.room.revealedResultsCount = this.room.finalResults.length;
    this.logEvent('game_end');
    this.syncToDB();
    this.broadcast();
    logger.info('Game ended by host', {
      room: this.room.code,
      players: this.room.players.size,
      results: this.room.finalResults.length,
    });
  }

  // ========================================================================
  // Pause / Resume
  // ========================================================================

  /**
   * Pause the game: save timer state, clear timers, transition to PAUSED.
   */
  pause(): void {
    if (this.room.isPaused) return;

    this.timerManager.pauseAll(this.room);
    this.room.pausedPhase = this.room.phase;
    this.room.isPaused = true;
    this.room.phase = 'PAUSED';

    this.logEvent('game_paused');
    this.syncToDB();
    this.broadcast();
  }

  /**
   * Resume the game: restore timer state, transition back from PAUSED.
   */
  resume(): void {
    if (!this.room.isPaused) return;

    const wasPhase = this.room.pausedPhase ?? 'LOBBY';
    const paused = this.timerManager.peekPausedTimer();
    this.room.phase = wasPhase;
    this.room.isPaused = false;
    // Keep pausedPhase until timers are restarted — resumeAll used to read
    // it after it had already been cleared, which skipped every timer.

    this.logEvent('game_resumed');
    this.syncToDB();
    this.broadcast();

    if (wasPhase === 'RESULTS_REVEAL') {
      this.resumeResultsReveal();
    } else if (wasPhase === 'NUMBER_SELECTION') {
      this.timerManager.resumeAll(
        this.room,
        () => this.broadcast(),
        () => this.revealNumbers(),
        wasPhase,
      );
    } else if (wasPhase === 'GEM_SELECTION') {
      this.timerManager.resumeAll(
        this.room,
        () => this.broadcast(),
        (pid) => {
          if (pid) this.onGemPickTimeout(pid);
          else this.advanceToNextPicker();
        },
        wasPhase,
      );
      const pickerId = this.room.getCurrentPickerId();
      const picker = pickerId ? this.room.players.get(pickerId) : null;
      if (picker && !picker.isConnected) {
        this.advanceToNextPicker();
      }
    } else if (paused?.kind === 'delay') {
      const remaining = Math.max(0, paused.remaining);
      const key = paused.key;
      this.timerManager.clearPausedTimer();
      if (remaining <= 0) {
        this.onDelayComplete(key);
      } else {
        this.timerManager.startPausableDelay(
          this.room,
          key,
          remaining,
          () => this.onDelayComplete(key),
        );
      }
    }

    this.room.pausedPhase = null;
    this.timerManager.clearPausedTimer();
    this.syncToDB();
  }

  // ========================================================================
  // Host controls
  // ========================================================================

  /**
   * Skip the current picker (host override).
   * Clears the picker's timer and advances to the next.
   */
  skipPlayer(playerId: string): void {
    const currentPickerId = this.room.getCurrentPickerId();
    if (!currentPickerId || currentPickerId !== playerId) {
      logger.warn('skipPlayer ignored: not the current picker', {
        room: this.room.code,
        playerId,
        currentPickerId,
      });
      return;
    }
    this.timerManager.clear(`gem_pick_${playerId}`);
    this.logEvent('player_skipped', this.room.currentRound, undefined, playerId);
    this.advanceToNextPicker();
  }

  /**
   * Manually advance to the next phase (host override).
   * Clears any active delay timers and proceeds immediately.
   */
  advancePhase(): void {
    const phase = this.room.phase;

    switch (phase) {
      case 'ROUND_START':
      case 'GEM_REVEAL':
        this.timerManager.clear('gem_reveal');
        this.startNumberSelectionPhase();
        break;

      case 'NUMBER_SELECTION':
        this.timerManager.clear('number_selection');
        this.revealNumbers();
        break;

      case 'NUMBER_REVEAL':
        this.timerManager.clear('number_reveal');
        this.calculateOrder();
        break;

      case 'ORDER_CALCULATION':
        this.timerManager.clear('order_calc');
        this.startGemSelection();
        break;

      case 'GEM_SELECTION':
        // Skip current picker
        if (this.room.hasRemainingPickers()) {
          this.skipPlayer(this.room.getCurrentPickerId() ?? '');
        } else {
          this.endRound();
        }
        break;

      case 'ROUND_END':
        this.timerManager.clear('round_end');
        if (this.room.currentRound >= TOTAL_ROUNDS) {
          this.calculateFinalScores();
        } else {
          this.startRound();
        }
        break;

      case 'RESULTS_REVEAL':
        // Skip to game over
        this.timerManager.clearAll();
        this.room.phase = 'GAME_OVER';
        this.room.revealedResultsCount = this.room.finalResults.length;
        this.syncToDB();
        this.broadcast();
        break;

      default:
        logger.warn('advancePhase: no handler for phase', { phase });
        break;
    }
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  /**
   * Drop disconnected seats from memory and SQLite.
   */
  private dropOfflineSeats(): void {
    for (const player of [...this.room.players.values()]) {
      if (player.isConnected) continue;
      this.room.players.delete(player.id);
      this.room.playerAuthTokens.delete(player.id);
      this.room.playerSocketIds.delete(player.id);
      try {
        playerRepo.deletePlayer(player.id);
      } catch (err) {
        logger.error('Failed to delete disconnected player', {
          error: err instanceof Error ? err.message : err,
          room: this.room.code,
          playerId: player.id,
        });
      }
    }
  }

  /**
   * Resume the remaining worst→best result reveals after a pause.
   */
  private resumeResultsReveal(): void {
    const sortedResults = [...this.room.finalResults].sort(
      (a, b) => a.finalScore - b.finalScore,
    );
    const remaining = sortedResults.slice(this.room.revealedResultsCount);

    remaining.forEach((result, index) => {
      this.timerManager.startDelay(
        `reveal_${this.room.revealedResultsCount + index}`,
        (index + 1) * TIMING_CONFIG.FINAL_REVEAL_INTERVAL_MS,
        () => {
          this.room.revealedResultsCount++;
          this.logEvent('result_revealed', undefined, undefined, result.playerId, {
            rank: result.finalRank,
            score: result.finalScore,
          });
          this.broadcast();
        },
      );
    });

    const totalRevealTime =
      (remaining.length + 1) * TIMING_CONFIG.FINAL_REVEAL_INTERVAL_MS;
    this.timerManager.startDelay('game_over', totalRevealTime, () => {
      this.room.phase = 'GAME_OVER';
      this.room.revealedResultsCount = this.room.finalResults.length;
      this.logEvent('game_end');
      this.syncToDB();
      this.broadcast();
    });
  }

  /**
   * Complete a pausable delay whose remaining time just elapsed (or was 0).
   */
  private onDelayComplete(key: string): void {
    switch (key) {
      case 'gem_reveal':
        this.startNumberSelectionPhase();
        break;
      case 'number_reveal':
        this.calculateOrder();
        break;
      case 'order_calc':
        this.startGemSelection();
        break;
      case 'round_end':
        if (this.room.currentRound >= TOTAL_ROUNDS) {
          this.calculateFinalScores();
        } else {
          this.startRound();
        }
        break;
      default:
        if (key.startsWith('reveal_') || key === 'game_over') {
          this.resumeResultsReveal();
        } else {
          logger.warn('Unknown delay key on resume', { key, room: this.room.code });
        }
        break;
    }
  }

  /**
   * Start the timer for the current picker, or end the round if no picker.
   * Disconnected seats are skipped immediately so the table is not blocked
   * for GEM_PICK_SECONDS on a player who cannot act.
   */
  private startCurrentPickerTimer(): void {
    while (this.room.hasRemainingPickers() && !this.room.allGemsPicked()) {
      const playerId = this.room.getCurrentPickerId();
      if (!playerId) break;

      const picker = this.room.players.get(playerId);
      if (picker && !picker.isConnected) {
        logger.info('Skipping disconnected gem picker', {
          room: this.room.code,
          round: this.room.currentRound,
          playerId,
        });
        this.logEvent('gem_pick_timeout', this.room.currentRound, undefined, playerId);
        stateMachine.advancePicker(this.room);
        continue;
      }

      this.timerManager.startGemPickTimer(
        this.room,
        playerId,
        () => {
          this.broadcast();
        },
        (pid) => {
          this.onGemPickTimeout(pid);
        },
      );
      return;
    }

    this.endRound();
  }

  /**
   * Save current room state to SQLite.
   */
  private syncToDB(): void {
    try {
      roomRepo.updateRoom(this.room.code, {
        phase: this.room.phase,
        currentRound: this.room.currentRound,
        gameSession: this.room.gameSession,
        isPaused: this.room.isPaused,
        pausedPhase: this.room.pausedPhase,
        timerRemaining: this.room.timerDeadline
          ? Math.max(0, this.room.timerDeadline - Date.now())
          : this.room.timerRemaining,
        timerDeadline: this.room.timerDeadline,
        hostId: this.room.hostSocketId,
        screenId: this.room.screenSocketId,
      });
    } catch (err) {
      logger.error('Failed to sync room to DB', { error: err, room: this.room.code });
    }
  }

  /**
   * Sync a specific player's state to the DB.
   */
  private syncPlayerState(playerId: string): void {
    const player = this.room.players.get(playerId);
    if (!player) return;

    try {
      playerRepo.updatePlayerState(playerId, {
        isReady: player.isReady,
        availableNumbers: player.availableNumbers,
        usedNumbers: player.usedNumbers,
        roundSubmission: player.roundSubmission,
        gems: player.gems,
        missions: player.missions,
        finalScore: player.finalScore,
        finalRank: player.finalRank,
      });
    } catch (err) {
      logger.error('Failed to sync player state to DB', {
        error: err,
        playerId,
      });
    }
  }

  /**
   * Create gem records in the DB for the current round's gems.
   */
  private syncGems(): void {
    for (const gem of this.room.currentGems) {
      try {
        gemRepo.createGem(
          gem.id,
          this.room.code,
          this.room.currentRound,
          gem.color,
          gem.value,
        );
      } catch (err) {
        // Gem might already exist (e.g. after restore); ignore
      }
    }
  }

  /**
   * Update a gem's pick info in the DB.
   */
  private syncGemPick(gemId: string, pickedBy: string, pickOrder: number): void {
    try {
      gemRepo.updateGemPick(gemId, pickedBy, pickOrder);
    } catch (err) {
      logger.error('Failed to sync gem pick to DB', { error: err, gemId });
    }
  }

  /**
   * Persist every seated player's score/missions so admin history survives
   * even if the room is later restarted.
   */
  private persistAllPlayerScores(): void {
    for (const player of this.room.players.values()) {
      this.syncPlayerState(player.id);
    }
  }

  /**
   * Broadcast the current room state to all connected clients.
   */
  private broadcast(): void {
    this.broadcastFn(this.room);
  }

  /**
   * Log a game event to history.
   */
  private logEvent(
    eventType: string,
    roundNumber?: number,
    phase?: GamePhase,
    playerId?: string,
    eventData?: unknown,
  ): void {
    this.history.log(eventType, roundNumber, phase, playerId, eventData);
  }
}
