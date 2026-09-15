import type {
  Player,
  Gem,
  GamePhase,
  CollisionGroup,
  FinalResult,
  PlayerSeat,
  TimerInfo,
  QueueEntry,
  GameEvent,
  PublicGameState,
  PlayerPrivateState,
  HostGameState,
  QueueState,
  ColorBonus,
  GemColor,
} from '@treasure-contest/shared';
import {
  calculateBaseScore,
  calculateColorBonus,
  MAX_PLAYERS,
  DEFAULT_TARGET_PLAYERS,
  TOTAL_ROUNDS,
} from '@treasure-contest/shared';

// ============================================================================
// RoundHistory: per-round data needed for mission checks
// ============================================================================

/**
 * Tracks per-round data needed for mission checks at final settlement.
 *
 * Each entry captures the complete state of a single round, including:
 * - The gems that were on the board
 * - Each player's number submission (null = did not submit)
 * - The calculated selection order
 * - Collision groups and voided numbers
 * - Per-player gem results (whether they got a gem and which one)
 */
export interface RoundHistory {
  round: number;
  gems: Gem[];
  submissions: Record<string, number | null>;
  selectionOrder: string[];
  collisionGroups: CollisionGroup[];
  voidedNumbers: number[];
  gemResults: { playerId: string; gotGem: boolean; gem?: Gem }[];
}

// ============================================================================
// Room: In-memory authoritative game state
// ============================================================================

/**
 * The authoritative in-memory state object for a single game room.
 *
 * This class holds ALL mutable game state and provides role-filtered
 * snapshot methods (`toPublicState`, `toPlayerPrivateState`, `toHostState`,
 * `toQueueState`) that produce the DTOs sent to clients via `state:sync`.
 *
 * The class itself does NOT perform state transitions or validation —
 * that is the job of the state machine (`state-machine.ts`). The class
 * also does NOT manage timers or broadcast — that is the job of the
 * game engine (`game-engine.ts`).
 */
export class Room {
  // -- Room identity --
  code: string;
  hostName: string;
  hostToken: string;
  hostSocketId: string | null = null;
  screenSocketId: string | null = null;

  // -- Game flow state --
  phase: GamePhase = 'LOBBY';
  currentRound: number = 0;
  maxPlayers: number = MAX_PLAYERS;
  targetPlayers: number = DEFAULT_TARGET_PLAYERS;

  // -- Players (Map for O(1) lookup by playerId) --
  players: Map<string, Player> = new Map();

  // -- Current round gems --
  currentGems: Gem[] = [];

  // -- Number reveal (populated during NUMBER_REVEAL) --
  revealedNumbers: { playerId: string; number: number }[] = [];

  // -- Selection order (playerIds, highest number first) --
  selectionOrder: string[] = [];
  collisionGroups: CollisionGroup[] = [];
  voidedNumbers: number[] = [];

  // -- Gem selection state --
  currentPickerIndex: number = 0;

  // -- Round 3 ranking (playerIds ordered by base score, for H09 mission) --
  round3Ranking: string[] = [];

  // -- Final results --
  finalResults: FinalResult[] = [];
  revealedResultsCount: number = 0;

  // -- Game session (for cross-game isolation) --
  gameSession: number = 1;

  /** Latest auth tokens keyed by playerId (sent in private snapshots after restart). */
  playerAuthTokens: Map<string, string> = new Map();

  /** Live socket id for each seated player; used to ignore stale disconnects. */
  playerSocketIds: Map<string, string> = new Map();

  // -- Pause state --
  isPaused: boolean = false;
  pausedPhase: GamePhase | null = null;
  timerRemaining: number = 0;
  timerDeadline: number | null = null;

  // -- Per-round tracking for mission checks --
  roundHistory: RoundHistory[] = [];

  // -- Waiting queue --
  queue: QueueEntry[] = [];

  // -- Event log (recent events for host view) --
  eventLog: GameEvent[] = [];

  constructor(
    code: string,
    hostName: string,
    hostToken: string,
    targetPlayers: number,
  ) {
    this.code = code;
    this.hostName = hostName;
    this.hostToken = hostToken;
    this.targetPlayers = targetPlayers;
  }

  // ========================================================================
  // Helper methods
  // ========================================================================

  /**
   * Return all players that are currently connected.
   */
  getConnectedPlayers(): Player[] {
    return Array.from(this.players.values()).filter((p) => p.isConnected);
  }

  /**
   * Return the player occupying the given seat number, or undefined.
   */
  getPlayerBySeat(seatNumber: number): Player | undefined {
    for (const player of this.players.values()) {
      if (player.seatNumber === seatNumber) return player;
    }
    return undefined;
  }

  /**
   * Return the next available seat number (1-based).
   * Scans existing seats and returns the lowest unused number.
   */
  getNextSeatNumber(): number {
    const usedSeats = new Set<number>();
    for (const player of this.players.values()) {
      usedSeats.add(player.seatNumber);
    }
    for (let seat = 1; seat <= this.maxPlayers; seat++) {
      if (!usedSeats.has(seat)) return seat;
    }
    return this.maxPlayers + 1;
  }

  /**
   * Return the playerId of the current picker during GEM_SELECTION,
   * or null if not in that phase or no more pickers.
   */
  /**
   * Phase the UI should render while paused (the phase we will resume into).
   */
  getViewPhase(): GamePhase {
    if (this.phase === 'PAUSED' && this.pausedPhase) return this.pausedPhase;
    return this.phase;
  }

  getCurrentPickerId(): string | null {
    if (this.getViewPhase() !== 'GEM_SELECTION') return null;
    if (this.currentPickerIndex >= this.selectionOrder.length) return null;
    return this.selectionOrder[this.currentPickerIndex] ?? null;
  }

  // ========================================================================
  // State snapshot methods (role-filtered DTOs)
  // ========================================================================

  /**
   * Build the public game state visible to all clients.
   * Contains no secret information.
   */
  toPublicState(): PublicGameState {
    const playerSeats: PlayerSeat[] = Array.from(this.players.values())
      .sort((a, b) => a.seatNumber - b.seatNumber)
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        seatNumber: p.seatNumber,
        isConnected: p.isConnected,
        isReady: p.isReady,
      }));

    const currentPickerId = this.getCurrentPickerId();

    const timer: TimerInfo = {
      remaining: this.timerRemaining,
      deadline: this.timerDeadline,
      ...(currentPickerId !== null ? { currentPlayerId: currentPickerId } : {}),
    };

    // Determine which fields to show based on the visible phase.
    // While PAUSED, keep the frozen scene (numbers/order/picker) instead of
    // blanking the big screen.
    const viewPhase = this.getViewPhase();
    const showOrderInfo =
      viewPhase === 'ORDER_CALCULATION' ||
      viewPhase === 'GEM_SELECTION' ||
      viewPhase === 'ROUND_END' ||
      viewPhase === 'FINAL_CALCULATION' ||
      viewPhase === 'RESULTS_REVEAL' ||
      viewPhase === 'GAME_OVER';

    const showRevealedNumbers =
      viewPhase === 'NUMBER_REVEAL' ||
      viewPhase === 'ORDER_CALCULATION' ||
      viewPhase === 'GEM_SELECTION' ||
      viewPhase === 'ROUND_END' ||
      viewPhase === 'FINAL_CALCULATION' ||
      viewPhase === 'RESULTS_REVEAL' ||
      viewPhase === 'GAME_OVER';

    // Determine final results visibility.
    // Reveal ceremony is worst → best (lowest score first). Rank-sorted
    // `finalResults` is best-first, so slice a score-ascending copy instead.
    let finalResults: FinalResult[] | null = null;
    if (viewPhase === 'RESULTS_REVEAL') {
      const revealOrder = [...this.finalResults].sort(
        (a, b) => a.finalScore - b.finalScore,
      );
      finalResults = revealOrder.slice(0, this.revealedResultsCount);
    } else if (viewPhase === 'GAME_OVER') {
      finalResults = this.finalResults;
    }

    return {
      phase: this.phase,
      currentRound: this.currentRound,
      gameSession: this.gameSession,
      isPaused: this.isPaused,
      pausedPhase: this.pausedPhase,
      gems: this.currentGems,
      revealedNumbers: showRevealedNumbers ? this.revealedNumbers : [],
      selectionOrder: showOrderInfo ? this.selectionOrder : [],
      collisionGroups: showOrderInfo ? this.collisionGroups : [],
      voidedNumbers: showOrderInfo ? this.voidedNumbers : [],
      playerSeats,
      currentPickerId,
      timer,
      queueCount: this.queue.length,
      finalResults,
      targetPlayers: this.targetPlayers,
    };
  }

  /**
   * Build the private state for a specific player.
   * Sent only to that player's socket connection.
   */
  toPlayerPrivateState(playerId: string): PlayerPrivateState | null {
    const player = this.players.get(playerId);
    if (!player) return null;

    const baseScore = calculateBaseScore(player.gems);
    const { bonuses, colorCounts } = calculateColorBonus(player.gems);

    // Color bonuses as ColorBonus[]
    const colorBonuses: ColorBonus[] = bonuses;

    // finalScore/finalRank are null until FINAL_CALCULATION
    const scoresCalculated = player.finalRank !== null;
    const finalScore = scoresCalculated ? player.finalScore : null;
    const finalRank = scoresCalculated ? player.finalRank : null;

    // Suppress unused variable lint
    void colorCounts;

    const authToken = this.playerAuthTokens.get(playerId);

    return {
      playerId: player.id,
      availableNumbers: player.availableNumbers,
      usedNumbers: player.usedNumbers,
      roundSubmission: player.roundSubmission,
      gems: player.gems,
      missions: player.missions,
      baseScore,
      colorBonuses,
      finalScore,
      finalRank,
      ...(authToken ? { authToken } : {}),
    };
  }

  /**
   * Build the host state containing all players' full data,
   * the queue list, event log, and mission overview.
   */
  toHostState(): HostGameState {
    const allPlayers: Player[] = Array.from(this.players.values()).sort(
      (a, b) => a.seatNumber - b.seatNumber,
    );

    const missionOverview = allPlayers.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      missions: p.missions,
    }));

    return {
      allPlayers,
      queueList: this.queue,
      eventLog: this.eventLog,
      missionOverview,
    };
  }

  /**
   * Build the queue state for a queued player.
   *
   * @param queueEntryId - Optional queue entry ID to determine position.
   *                        If not provided, position defaults to 0.
   */
  toQueueState(queueEntryId?: string): QueueState {
    let position = 0;
    if (queueEntryId) {
      const entry = this.queue.find((e) => e.id === queueEntryId);
      if (entry) {
        position = entry.position;
      }
    }

    const playerCount = this.players.size;
    const estimatedWait =
      position > 0
        ? `${Math.ceil(position * 5)} minutes`
        : 'Unknown';

    return {
      position,
      totalInQueue: this.queue.length,
      roomCode: this.code,
      currentPhase: this.phase,
      playerCount,
      targetPlayers: this.targetPlayers,
      estimatedWait,
    };
  }

  // ========================================================================
  // Utility methods
  // ========================================================================

  /**
   * Count how many gems in the current round have been picked.
   */
  getPickedGemCount(): number {
    return this.currentGems.filter((g) => g.pickedBy !== undefined).length;
  }

  /**
   * Check if all gems in the current round have been picked.
   */
  allGemsPicked(): boolean {
    return this.currentGems.every((g) => g.pickedBy !== undefined);
  }

  /**
   * Check if there are remaining pickers who haven't picked.
   */
  hasRemainingPickers(): boolean {
    return this.currentPickerIndex < this.selectionOrder.length;
  }

  /**
   * Get the total number of rounds (from constants).
   */
  getTotalRounds(): number {
    return TOTAL_ROUNDS;
  }

  /**
   * Count distinct colors in a set of gems.
   * (Utility for display; not used in core logic.)
   */
  static countDistinctColors(gems: Gem[]): number {
    const colors = new Set<GemColor>();
    for (const gem of gems) {
      colors.add(gem.color);
    }
    return colors.size;
  }
}
