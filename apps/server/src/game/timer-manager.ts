import type { GamePhase } from '@treasure-contest/shared';
import { TIMING_CONFIG } from '@treasure-contest/shared';
import type { Room } from './room.js';

// ============================================================================
// TimerManager
// ============================================================================

/**
 * Manages all countdown timers for the game engine.
 *
 * Uses setInterval for per-second tick timers (number selection, gem pick)
 * and setTimeout for one-shot delay timers (phase transitions).
 *
 * Timer keys:
 * - 'number_selection': The 15-second number selection countdown
 * - 'gem_pick_{playerId}': The 5-second gem pick countdown for a specific player
 * - arbitrary keys for delay timers (e.g. 'gem_reveal', 'number_reveal', etc.)
 *
 * Pause/Resume:
 * - pauseAll() clears all active timers and saves remaining time to room
 * - resumeAll() restarts the appropriate timer based on room.pausedPhase
 */
export class TimerManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Tracks what kind of timer was running when paused, so resumeAll
   * can restart the correct timer type.
   */
  private pausedTimerType:
    | { kind: 'number_selection'; remaining: number }
    | { kind: 'gem_pick'; remaining: number; playerId: string }
    | { kind: 'delay'; remaining: number; key: string }
    | null = null;

  // ------------------------------------------------------------------------
  // Number selection timer (15 seconds)
  // ------------------------------------------------------------------------

  /**
   * Start the number selection countdown.
   *
   * @param room      The room to update timer state on.
   * @param onTick    Called every second with the remaining seconds.
   * @param onExpire  Called when the countdown reaches zero.
   * @param remainingMs  Optional remaining time (for resume after pause).
   *                     If not provided, uses the full configured duration.
   */
  startNumberSelection(
    room: Room,
    onTick: (remaining: number) => void,
    onExpire: () => void,
    remainingMs?: number,
  ): void {
    const key = 'number_selection';
    this.clear(key);

    const totalMs =
      remainingMs ?? TIMING_CONFIG.NUMBER_SELECTION_SECONDS * 1000;
    const startTime = Date.now();
    room.timerDeadline = startTime + totalMs;
    room.timerRemaining = totalMs;

    // Emit initial tick
    const initialSeconds = Math.ceil(totalMs / 1000);
    onTick(initialSeconds);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalMs - elapsed);
      const remainingSeconds = Math.ceil(remaining / 1000);

      room.timerRemaining = remaining;
      onTick(remainingSeconds);

      if (remaining <= 0) {
        this.clear(key);
        onExpire();
      }
    }, 1000);

    this.intervals.set(key, interval);
  }

  // ------------------------------------------------------------------------
  // Gem pick timer (5 seconds per player)
  // ------------------------------------------------------------------------

  /**
   * Start the gem pick countdown for a specific player.
   *
   * @param room      The room to update timer state on.
   * @param playerId  The player who is currently picking.
   * @param onTick    Called every second with remaining seconds and playerId.
   * @param onExpire  Called when the countdown reaches zero.
   * @param remainingMs  Optional remaining time (for resume after pause).
   */
  startGemPickTimer(
    room: Room,
    playerId: string,
    onTick: (remaining: number, playerId: string) => void,
    onExpire: (playerId: string) => void,
    remainingMs?: number,
  ): void {
    const key = `gem_pick_${playerId}`;
    this.clear(key);

    const totalMs =
      remainingMs ?? TIMING_CONFIG.GEM_PICK_SECONDS_PER_PLAYER * 1000;
    const startTime = Date.now();
    room.timerDeadline = startTime + totalMs;
    room.timerRemaining = totalMs;

    // Emit initial tick
    const initialSeconds = Math.ceil(totalMs / 1000);
    onTick(initialSeconds, playerId);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalMs - elapsed);
      const remainingSeconds = Math.ceil(remaining / 1000);

      room.timerRemaining = remaining;
      onTick(remainingSeconds, playerId);

      if (remaining <= 0) {
        this.clear(key);
        onExpire(playerId);
      }
    }, 1000);

    this.intervals.set(key, interval);
  }

  // ------------------------------------------------------------------------
  // Delay timers (one-shot, for phase transitions)
  // ------------------------------------------------------------------------

  /**
   * Start a one-shot delay timer.
   *
   * @param key      Unique key for this timer.
   * @param ms       Duration in milliseconds.
   * @param callback Called after the delay completes.
   */
  startDelay(key: string, ms: number, callback: () => void): void {
    this.clear(key);

    const timer = setTimeout(() => {
      this.clear(key);
      callback();
    }, ms);

    this.timers.set(key, timer);
  }

  /**
   * Start a one-shot delay timer with remaining time tracking.
   * Used when the delay needs to be pausable.
   */
  startPausableDelay(
    room: Room,
    key: string,
    ms: number,
    callback: () => void,
  ): void {
    this.clear(key);

    const startTime = Date.now();
    room.timerDeadline = startTime + ms;
    room.timerRemaining = ms;

    const timer = setTimeout(() => {
      this.clear(key);
      room.timerRemaining = 0;
      room.timerDeadline = null;
      callback();
    }, ms);

    this.timers.set(key, timer);
  }

  // ------------------------------------------------------------------------
  // Pause / Resume
  // ------------------------------------------------------------------------

  /**
   * Pause all active timers and save remaining time to the room.
   *
   * Determines which timer was running (number selection, gem pick, or delay)
   * and saves the remaining time and context to `pausedTimerType`.
   */
  pauseAll(room: Room): void {
    // Determine remaining time
    const remainingMs = room.timerDeadline
      ? Math.max(0, room.timerDeadline - Date.now())
      : room.timerRemaining;

    room.timerRemaining = remainingMs;

    // Determine what kind of timer was running
    if (this.intervals.has('number_selection')) {
      this.pausedTimerType = {
        kind: 'number_selection',
        remaining: remainingMs,
      };
    } else {
      // Check for gem pick intervals
      let foundGemPick = false;
      for (const [key] of this.intervals) {
        if (key.startsWith('gem_pick_')) {
          const playerId = key.substring('gem_pick_'.length);
          this.pausedTimerType = {
            kind: 'gem_pick',
            remaining: remainingMs,
            playerId,
          };
          foundGemPick = true;
          break;
        }
      }

      if (!foundGemPick) {
        // Check for delay timers
        let foundDelay = false;
        for (const [key] of this.timers) {
          if (
            key !== 'number_selection' &&
            !key.startsWith('gem_pick_')
          ) {
            this.pausedTimerType = {
              kind: 'delay',
              remaining: remainingMs,
              key,
            };
            foundDelay = true;
            break;
          }
        }

        if (!foundDelay) {
          this.pausedTimerType = null;
        }
      }
    }

    // Clear all timers and intervals
    for (const [, timer] of this.timers) {
      clearTimeout(timer);
    }
    for (const [, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.timers.clear();
    this.intervals.clear();
  }

  /**
   * Resume timers after a pause.
   *
   * Restarts the appropriate timer based on the saved pausedTimerType.
   * The game engine provides callbacks for tick and expiry.
   *
   * @param room      The room with saved timer state.
   * @param onTick    Callback for per-second ticks.
   * @param onExpire  Callback for timer expiry.
   */
  resumeAll(
    room: Room,
    onTick: (remaining: number, playerId?: string) => void,
    onExpire: (playerId?: string) => void,
  ): void {
    if (!this.pausedTimerType) return;

    const remaining = this.pausedTimerType.remaining;
    this.pausedTimerType = null;

    if (remaining <= 0) {
      // Timer had already expired; fire expiry immediately
      const phase: GamePhase = room.pausedPhase ?? room.phase;
      if (phase === 'GEM_SELECTION') {
        const playerId = room.getCurrentPickerId();
        onExpire(playerId ?? undefined);
      } else {
        onExpire();
      }
      return;
    }

    switch (room.pausedPhase) {
      case 'NUMBER_SELECTION':
        this.startNumberSelection(
          room,
          (r) => onTick(r),
          () => onExpire(),
          remaining,
        );
        break;

      case 'GEM_SELECTION': {
        const playerId = room.getCurrentPickerId();
        if (playerId) {
          this.startGemPickTimer(
            room,
            playerId,
            (r, pid) => onTick(r, pid),
            (pid) => onExpire(pid),
            remaining,
          );
        }
        break;
      }

      default:
        // For delay timers, just restart with remaining time
        // The game engine handles this case by calling the appropriate
        // flow method directly
        break;
    }
  }

  // ------------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------------

  /**
   * Clear a specific timer or interval by key.
   */
  clear(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    const interval = this.intervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(key);
    }
  }

  /**
   * Clear all timers and intervals.
   */
  clearAll(): void {
    for (const [, timer] of this.timers) {
      clearTimeout(timer);
    }
    for (const [, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.timers.clear();
    this.intervals.clear();
    this.pausedTimerType = null;
  }

  /**
   * Get the remaining time for the active timer.
   */
  getRemainingTime(room: Room): number {
    if (room.timerDeadline) {
      return Math.max(0, room.timerDeadline - Date.now());
    }
    return room.timerRemaining;
  }
}
