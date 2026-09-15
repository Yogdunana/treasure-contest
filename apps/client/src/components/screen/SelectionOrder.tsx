/**
 * SelectionOrder - ORDER_CALCULATION phase display for the big screen.
 *
 * Players slide in from the right in selection order.  Shows the order
 * with arrows between players.  Collision groups are shown together.
 * Voided players are shown with an X mark.  "选宝顺序" title at top.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import {
  type CollisionGroup,
  type PlayerSeat,
} from '@treasure-contest/shared';
import {
  slideIn,
  staggerContainer,
  fadeIn,
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

/** Border colors for collision groups. */
const COLLISION_BORDER = [
  'border-amber-400',
  'border-sky-400',
  'border-emerald-400',
  'border-pink-400',
  'border-cyan-400',
];

export function SelectionOrder() {
  const selectionOrder = useGameStore((s) => s.selectionOrder);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const collisionGroups = useGameStore((s) => s.collisionGroups);
  const voidedNumbers = useGameStore((s) => s.voidedNumbers);

  // Map playerId -> seat info
  const seatMap = new Map<string, PlayerSeat>();
  for (const seat of playerSeats) {
    seatMap.set(seat.playerId, seat);
  }

  // Map playerId -> collision group info
  const collisionMap = new Map<string, { group: CollisionGroup; index: number }>();
  collisionGroups.forEach((group, groupIndex) => {
    for (const pid of group.playerIds) {
      collisionMap.set(pid, { group, index: groupIndex });
    }
  });

  // Check if a player is voided
  const isVoidedPlayer = (playerId: string): boolean => {
    const info = collisionMap.get(playerId);
    return info?.group.isVoided ?? false;
  };

  const crowded = selectionOrder.length >= 7;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={clsx(
        'flex h-full w-full flex-col items-center justify-center',
        crowded ? 'gap-5' : 'gap-8',
      )}
    >
      {/* Title */}
      <motion.div variants={fadeIn} className="text-center">
        <h2
          className="text-5xl font-bold text-violet-300"
          style={{ textShadow: '0 0 30px rgba(139,92,246,0.6)' }}
        >
          选宝顺序
        </h2>
        <p className="mt-2 text-2xl text-slate-400">
          按数字从大到小依次选择宝石
        </p>
      </motion.div>

      {/* Selection order list */}
      {selectionOrder.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          className={clsx(
            'flex flex-wrap items-center justify-center',
            crowded ? 'gap-2' : 'gap-3',
          )}
        >
          {selectionOrder.map((playerId, index) => {
            const seat = seatMap.get(playerId);
            if (!seat) return null;

            const isVoided = isVoidedPlayer(playerId);
            const collisionInfo = collisionMap.get(playerId);
            const collisionIndex = collisionInfo?.index ?? 0;
            const hasCollision = collisionInfo !== undefined && !isVoided;

            const borderClass = isVoided
              ? 'border-red-500'
              : hasCollision
                ? COLLISION_BORDER[collisionIndex % COLLISION_BORDER.length]
                : 'border-slate-600';

            const bgClass = isVoided
              ? 'bg-red-950/30'
              : hasCollision
                ? 'bg-slate-800/60'
                : 'bg-slate-800/60';

            return (
              <motion.div
                key={playerId}
                variants={slideIn}
                className="flex items-center"
              >
                {/* Order number */}
                <div className="mr-3 flex flex-col items-center">
                  <motion.span
                    className={clsx(
                      'flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold',
                      isVoided
                        ? 'bg-red-900/50 text-red-400'
                        : 'bg-violet-600 text-white',
                    )}
                    animate={
                      isVoided
                        ? undefined
                        : {
                            boxShadow: [
                              '0 0 0px rgba(139,92,246,0)',
                              '0 0 15px rgba(139,92,246,0.5)',
                              '0 0 0px rgba(139,92,246,0)',
                            ],
                          }
                    }
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.1,
                      ease: 'easeInOut',
                    }}
                  >
                    {isVoided ? '✕' : index + 1}
                  </motion.span>
                </div>

                {/* Player card */}
                <motion.div
                  className={clsx(
                    'flex flex-col items-center rounded-2xl border-2',
                    crowded ? 'gap-1 p-2.5' : 'gap-2 p-4',
                    borderClass,
                    bgClass,
                    isVoided && 'opacity-60',
                  )}
                >
                  {/* Seat number badge */}
                  <div
                    className={clsx(
                      'flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white',
                      SEAT_BG[(seat.seatNumber - 1) % SEAT_BG.length],
                    )}
                  >
                    {seat.seatNumber}
                  </div>

                  {/* Player name */}
                  <p className="max-w-[100px] truncate text-base font-semibold text-slate-100">
                    {seat.name}
                  </p>

                  {/* Voided indicator */}
                  {isVoided && (
                    <span className="rounded-full bg-red-900/60 px-2 py-0.5 text-xs font-bold text-red-300">
                      流局
                    </span>
                  )}
                </motion.div>

                {/* Arrow to next player */}
                {index < selectionOrder.length - 1 && !crowded && (
                  <motion.div
                    className="mx-2 flex items-center"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                  >
                    <svg
                      className="h-8 w-8 text-slate-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <motion.div variants={scaleIn} className="flex flex-col items-center gap-4">
          <motion.div
            className="h-12 w-12 rounded-full border-4 border-violet-500 border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-xl text-slate-400">正在计算选宝石顺序...</p>
        </motion.div>
      )}

      {/* Voided numbers info */}
      {voidedNumbers.length > 0 && (
        <motion.div
          variants={scaleIn}
          className="flex items-center gap-3 rounded-xl border-2 border-red-700/50 bg-red-950/30 px-6 py-3"
        >
          <span className="text-3xl">🚨</span>
          <div>
            <p className="text-lg font-bold text-red-400">流局玩家</p>
            <p className="text-base text-red-300">
              本轮无法参与宝石选择
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default SelectionOrder;
