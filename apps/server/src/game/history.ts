import type { GameEvent, GamePhase } from '@treasure-contest/shared';
import { addHistory } from '../db/repositories/history-repo.js';
import type { Room } from './room.js';

// ============================================================================
// HistoryLogger
// ============================================================================

/**
 * Game history logging utility.
 *
 * Writes events to both:
 * 1. The SQLite `game_history` table (persistent, for post-game analysis)
 * 2. The in-memory `room.eventLog` array (for the host's live event view)
 *
 * The in-memory log is capped at 200 entries to prevent unbounded growth.
 */
export class HistoryLogger {
  /** Maximum number of in-memory event log entries. */
  private static readonly MAX_EVENT_LOG = 200;

  constructor(private room: Room) {}

  /**
   * Log a game event.
   *
   * @param eventType  Event type identifier (e.g. 'game_start', 'number_submitted').
   * @param roundNumber  Optional round number context.
   * @param phase       Optional game phase context.
   * @param playerId    Optional player ID associated with the event.
   * @param eventData   Optional structured event data.
   * @returns The created GameEvent, or null if DB write failed.
   */
  log(
    eventType: string,
    roundNumber?: number,
    phase?: GamePhase,
    playerId?: string,
    eventData?: unknown,
  ): GameEvent | null {
    const effectiveRound = roundNumber ?? (this.room.currentRound > 0 ? this.room.currentRound : null);
    const effectivePhase = phase ?? this.room.phase;
    const effectivePlayer = playerId ?? null;

    // Write to DB
    let event: GameEvent | null = null;
    try {
      event = addHistory(
        this.room.code,
        effectiveRound,
        effectivePhase,
        eventType,
        effectivePlayer,
        eventData ?? {},
      );
    } catch (err) {
      // DB might not be available during early init; log to memory only
      event = this.createInMemoryEvent(
        eventType,
        effectiveRound,
        effectivePhase,
        effectivePlayer,
        eventData,
      );
    }

    if (event) {
      // Add to in-memory event log
      this.room.eventLog.unshift(event);

      // Trim the log to prevent unbounded growth
      if (this.room.eventLog.length > HistoryLogger.MAX_EVENT_LOG) {
        this.room.eventLog = this.room.eventLog.slice(
          0,
          HistoryLogger.MAX_EVENT_LOG,
        );
      }
    }

    return event;
  }

  /**
   * Create an in-memory-only GameEvent (when DB is unavailable).
   */
  private createInMemoryEvent(
    eventType: string,
    round: number | null,
    phase: GamePhase,
    playerId: string | null,
    eventData: unknown,
  ): GameEvent {
    return {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomCode: this.room.code,
      round,
      phase,
      eventType,
      playerId,
      data: eventData ?? {},
      timestamp: new Date().toISOString(),
    };
  }
}
