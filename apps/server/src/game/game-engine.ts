import type { GamePhase, FinalResult } from '@treasure-contest/shared';
import {
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
    this.logEvent('game_restart');
    this.syncToDB();
    this.broadcast();
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
    this.room.phase = wasPhase;
    this.room.isPaused = false;
    this.room.pausedPhase = null;

    this.logEvent('game_resumed');
    this.syncToDB();
    this.broadcast();

    // Resume appropriate timer based on the phase we were in
    if (wasPhase === 'NUMBER_SELECTION') {
      this.timerManager.resumeAll(
        this.room,
        () => this.broadcast(),
        () => this.revealNumbers(),
      );
    } else if (wasPhase === 'GEM_SELECTION') {
      const playerId = this.room.getCurrentPickerId();
      this.timerManager.resumeAll(
        this.room,
        () => this.broadcast(),
        (pid) => {
          if (pid) this.onGemPickTimeout(pid);
          else this.advanceToNextPicker();
        },
      );
    }
  }

  // ========================================================================
  // Host controls
  // ========================================================================

  /**
   * Skip the current picker (host override).
   * Clears the picker's timer and advances to the next.
   */
  skipPlayer(playerId: string): void {
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
   * Start the timer for the current picker, or end the round if no picker.
   */
  private startCurrentPickerTimer(): void {
    const playerId = this.room.getCurrentPickerId();

    if (!playerId) {
      // No more pickers; end the round
      this.endRound();
      return;
    }

    this.timerManager.startGemPickTimer(
      this.room,
      playerId,
      (remaining, pid) => {
        // onTick: broadcast timer state
        this.broadcast();
      },
      (pid) => {
        // onExpire: auto-skip
        this.onGemPickTimeout(pid);
      },
    );
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
