/**
 * TimerBar - Horizontal countdown progress bar.
 *
 * Reads timer information from the game store and renders a horizontal bar
 * that depletes as time runs out.  The bar color transitions from green to
 * yellow to red as the remaining time decreases.
 *
 * The total duration is inferred from the current game phase using the
 * TIMING_CONFIG constants from the shared package.
 */

import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import {
  TIMING_CONFIG,
  type GamePhase,
} from '@treasure-contest/shared';

/** Returns the total timer duration (in milliseconds) for the given phase. */
function getTotalDurationMs(phase: GamePhase): number {
  switch (phase) {
    case 'NUMBER_SELECTION':
      return TIMING_CONFIG.NUMBER_SELECTION_SECONDS * 1000;
    case 'GEM_SELECTION':
      return TIMING_CONFIG.GEM_PICK_SECONDS_PER_PLAYER * 1000;
    default:
      return TIMING_CONFIG.NUMBER_SELECTION_SECONDS * 1000;
  }
}

export function TimerBar() {
  const timer = useGameStore((s) => s.timer);
  const phase = useGameStore((s) => s.phase);

  if (!timer) return null;

  const totalMs = getTotalDurationMs(phase);
  const remainingMs = Math.max(0, timer.remaining);
  const ratio = totalMs > 0 ? remainingMs / totalMs : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  const colorClass =
    ratio > 0.5
      ? 'bg-emerald-500'
      : ratio > 0.25
        ? 'bg-amber-500'
        : 'bg-red-500';

  const textColorClass =
    ratio > 0.5
      ? 'text-emerald-400'
      : ratio > 0.25
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-slate-400">剩余时间</span>
        <span
          className={clsx(
            'text-sm font-bold tabular-nums',
            textColorClass,
          )}
        >
          {remainingSeconds}s
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-1000 ease-linear',
            colorClass,
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

export default TimerBar;
