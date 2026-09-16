/**
 * Compact rail of every player's collected gems (color + value).
 * Public information for the projector during the match.
 */

import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { GemIcon } from '../shared/GemIcon';
import { isBriefingPhase } from '@treasure-contest/shared';

const SEAT_BG = [
  'bg-rose-600',
  'bg-sky-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-violet-600',
  'bg-cyan-600',
  'bg-orange-600',
  'bg-pink-600',
];

export function PlayerCollections() {
  const phase = useGameStore((s) => s.phase);
  const pausedPhase = useGameStore((s) => s.pausedPhase);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const viewPhase = phase === 'PAUSED' && pausedPhase ? pausedPhase : phase;

  const hidden =
    viewPhase === 'LOBBY' ||
    isBriefingPhase(viewPhase) ||
    viewPhase === 'ROUND_END' ||
    viewPhase === 'RESULTS_REVEAL' ||
    viewPhase === 'GAME_OVER' ||
    viewPhase === 'FINAL_CALCULATION';

  if (hidden || playerSeats.length === 0) return null;

  const sorted = [...playerSeats].sort((a, b) => a.seatNumber - b.seatNumber);
  const crowded = sorted.length >= 7;

  return (
    <div className="relative z-20 shrink-0 border-t border-slate-800 bg-slate-950/80 px-4 py-2">
      <div
        className={clsx(
          'flex items-stretch justify-center',
          crowded ? 'gap-2' : 'gap-3',
        )}
      >
        {sorted.map((seat) => {
          const total = seat.gems.reduce((sum, gem) => sum + gem.value, 0);
          return (
            <div
              key={seat.playerId}
              className={clsx(
                'flex min-w-0 flex-1 items-center rounded-xl border border-slate-700 bg-slate-900/70',
                crowded ? 'gap-1.5 px-2 py-1.5' : 'gap-2 px-3 py-2',
              )}
            >
              <span
                className={clsx(
                  'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
                  crowded ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm',
                  SEAT_BG[(seat.seatNumber - 1) % SEAT_BG.length],
                )}
              >
                {seat.seatNumber}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p
                    className={clsx(
                      'truncate font-semibold text-slate-100',
                      crowded ? 'text-xs' : 'text-sm',
                    )}
                  >
                    {seat.name}
                  </p>
                  <p
                    className={clsx(
                      'shrink-0 font-bold tabular-nums text-amber-400',
                      crowded ? 'text-sm' : 'text-base',
                    )}
                  >
                    {total}
                  </p>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  {seat.gems.length === 0 ? (
                    <span className="text-[11px] text-slate-600">暂无宝石</span>
                  ) : (
                    seat.gems.map((gem) => (
                      <span
                        key={gem.id}
                        className="inline-flex items-center gap-0.5 rounded-md bg-slate-800 px-1 py-0.5"
                      >
                        <GemIcon
                          color={gem.color}
                          size={crowded ? 14 : 16}
                          value={gem.value}
                          variant="emoji"
                        />
                        <span className="text-[11px] font-bold tabular-nums text-slate-200">
                          {gem.value}
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlayerCollections;
