/**
 * NumberReveal - NUMBER_REVEAL phase display for the big screen.
 *
 * All players' numbers are revealed simultaneously with a flip animation.
 * Large number cards are arranged by seat.  Collision groups are
 * highlighted (same number = same color border).  Voided numbers are
 * shown with a red "流局!" warning.
 *
 * - "⚡ 撞号" indicators for 2-3 player collisions
 * - "🚨 流局!" for 4+ player voids
 * - 5-second display (server auto-advances)
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import {
  COLLISION_VOID_THRESHOLD,
  type CollisionGroup,
  type PlayerSeat,
} from '@treasure-contest/shared';
import {
  numberFlip,
  scaleIn,
} from '../../animations/variants';

/** Seat badge background colors. */
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

/** Border colors for collision groups (cycled by group index). */
const COLLISION_BORDER = [
  'border-amber-400',
  'border-sky-400',
  'border-emerald-400',
  'border-pink-400',
  'border-cyan-400',
];

/** Background tints for collision groups (matching border colors). */
const COLLISION_BG = [
  'bg-amber-950/30',
  'bg-sky-950/30',
  'bg-emerald-950/30',
  'bg-pink-950/30',
  'bg-cyan-950/30',
];

export function NumberReveal() {
  const playerSeats = useGameStore((s) => s.playerSeats);
  const revealedNumbers = useGameStore((s) => s.revealedNumbers);
  const voidedNumbers = useGameStore((s) => s.voidedNumbers);
  const collisionGroups = useGameStore((s) => s.collisionGroups);

  // Sort players by seat number
  const sorted = [...playerSeats].sort((a, b) => a.seatNumber - b.seatNumber);
  const dense = sorted.length >= 7;

  // Build a map of playerId -> collision group index (for border color)
  const playerCollisionMap = new Map<string, { group: CollisionGroup; index: number }>();
  collisionGroups.forEach((group, groupIndex) => {
    for (const pid of group.playerIds) {
      playerCollisionMap.set(pid, { group, index: groupIndex });
    }
  });

  return (
    <div className={clsx(
      'flex h-full w-full flex-col items-center justify-center',
      dense ? 'gap-4' : 'gap-8',
    )}>
      <div className="text-center">
        <h2
          className={clsx('font-bold text-violet-300', dense ? 'text-4xl' : 'text-5xl')}
          style={{ textShadow: '0 0 30px rgba(139,92,246,0.6)' }}
        >
          数字揭晓
        </h2>
        <p className={clsx('text-slate-400', dense ? 'mt-1 text-xl' : 'mt-2 text-2xl')}>
          看看每位玩家选择了什么数字
        </p>
      </div>

      <div className={clsx(
        'flex flex-wrap items-center justify-center',
        dense ? 'gap-3' : 'gap-6',
      )}>
        {sorted.map((seat: PlayerSeat) => {
          const number = revealedNumbers[seat.playerId];
          const collisionInfo = playerCollisionMap.get(seat.playerId);
          const isVoided = collisionInfo?.group.isVoided ?? false;
          const collisionIndex = collisionInfo?.index ?? 0;
          const collisionCount = collisionInfo?.group.playerIds.length ?? 0;
          const hasCollision = collisionInfo !== undefined;
          const isVoidedNumber =
            number !== undefined &&
            number !== null &&
            voidedNumbers.includes(number);

          const borderClass = isVoided
            ? 'border-red-500'
            : hasCollision
              ? COLLISION_BORDER[collisionIndex % COLLISION_BORDER.length]
              : 'border-slate-600';

          const bgClass = isVoided
            ? 'bg-red-950/30'
            : hasCollision
              ? COLLISION_BG[collisionIndex % COLLISION_BG.length]
              : 'bg-slate-800/60';

          return (
            <motion.div
              key={seat.playerId}
              variants={numberFlip}
              initial="hidden"
              animate="visible"
              className={clsx(
                'flex flex-col items-center rounded-2xl border-2',
                dense ? 'gap-2 p-3' : 'gap-3 p-5',
                borderClass,
                bgClass,
                isVoided && 'opacity-70',
              )}
              style={{
                perspective: 1000,
              }}
            >
              {/* Seat number badge */}
              <div
                className={clsx(
                  'flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white',
                  SEAT_BG[(seat.seatNumber - 1) % SEAT_BG.length],
                  !seat.isConnected && 'opacity-50',
                )}
              >
                {seat.seatNumber}
              </div>

              {/* Player name */}
              <p className="max-w-[120px] truncate text-lg font-semibold text-slate-100">
                {seat.name}
              </p>

              {/* Number card */}
              {number !== undefined && number !== null ? (
                <motion.div
                  className={clsx(
                    'flex items-center justify-center rounded-xl font-bold',
                    dense ? 'h-24 w-24 text-5xl' : 'h-32 w-32 text-6xl',
                    isVoided || isVoidedNumber
                      ? 'bg-red-900/60 text-red-400 line-through'
                      : 'bg-slate-700 text-slate-100',
                  )}
                  style={{
                    boxShadow: hasCollision && !isVoided
                      ? `0 0 20px var(--collision-glow, rgba(251,191,36,0.4))`
                      : undefined,
                  }}
                >
                  {number}
                </motion.div>
              ) : (
                <div className={clsx(
                  'flex items-center justify-center rounded-xl bg-slate-800 text-slate-600',
                  dense ? 'h-24 w-24 text-3xl' : 'h-32 w-32 text-4xl',
                )}>
                  ?
                </div>
              )}

              {/* Collision / void indicators */}
              {isVoided && (
                <motion.div
                  variants={scaleIn}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center gap-1 rounded-full bg-red-900/60 px-4 py-1 text-base font-bold text-red-300"
                >
                  <span>🚨</span>
                  <span>流局!</span>
                </motion.div>
              )}
              {!isVoided && hasCollision && collisionCount >= 2 && (
                <motion.div
                  variants={scaleIn}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center gap-1 rounded-full bg-amber-900/60 px-4 py-1 text-base font-bold text-amber-300"
                >
                  <span>⚡</span>
                  <span>撞号 ({collisionCount}人)</span>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {voidedNumbers.length > 0 && (
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          className="flex items-center gap-3 rounded-xl border-2 border-red-700/50 bg-red-950/30 px-6 py-3"
        >
          <span className="text-3xl">🚨</span>
          <div>
            <p className="text-xl font-bold text-red-400">流局数字</p>
            <p className="text-lg text-red-300">
              数字 {voidedNumbers.join(', ')} 因{COLLISION_VOID_THRESHOLD}人以上撞车作废
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default NumberReveal;
