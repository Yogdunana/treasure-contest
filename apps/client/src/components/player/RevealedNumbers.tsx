/**
 * RevealedNumbers - Shows all players' submitted numbers during NUMBER_REVEAL.
 *
 * Displays each player's name with their submitted number card.  The
 * number card uses a flip animation to reveal the submitted value.  Voided
 * numbers (4+ player collisions) are shown with a strikethrough style.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { numberFlip, staggerContainer } from '../../animations/variants';
import { PlayerAvatar } from '../shared/PlayerAvatar';

export function RevealedNumbers() {
  const playerSeats = useGameStore((s) => s.playerSeats);
  const revealedNumbers = useGameStore((s) => s.revealedNumbers);
  const voidedNumbers = useGameStore((s) => s.voidedNumbers);
  const collisionGroups = useGameStore((s) => s.collisionGroups);
  const myPlayerId = useGameStore((s) => s.playerId);

  // Build a set of voided player IDs (those in collision groups with 4+ players)
  const voidedPlayerIds = new Set<string>();
  for (const group of collisionGroups) {
    if (group.isVoided) {
      for (const pid of group.playerIds) {
        voidedPlayerIds.add(pid);
      }
    }
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex w-full flex-col gap-2"
    >
      <motion.div variants={numberFlip} className="mb-2 text-center">
        <p className="text-sm font-semibold text-violet-300">数字揭晓</p>
      </motion.div>

      {playerSeats.map((seat) => {
        const number = revealedNumbers[seat.playerId];
        const isVoided = voidedPlayerIds.has(seat.playerId);
        const isMe = seat.playerId === myPlayerId;

        return (
          <motion.div
            key={seat.playerId}
            variants={numberFlip}
            className={clsx(
              'flex items-center justify-between rounded-lg border p-2.5',
              isMe
                ? 'border-violet-500/50 bg-violet-900/20'
                : 'border-slate-700 bg-slate-800/50',
              isVoided && 'opacity-50',
            )}
          >
            <PlayerAvatar
              name={seat.name}
              seatNumber={seat.seatNumber}
              isCurrent={isMe}
              size="sm"
            />

            {number !== undefined && number !== null ? (
              <div
                className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold',
                  isVoided
                    ? 'bg-red-900/50 text-red-400 line-through'
                    : 'bg-slate-700 text-slate-100',
                )}
              >
                {number}
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-600">
                —
              </div>
            )}
          </motion.div>
        );
      })}

      {voidedNumbers.length > 0 && (
        <motion.p
          variants={numberFlip}
          className="mt-1 text-center text-xs text-red-400"
        >
          数字 {voidedNumbers.join(', ')} 因撞车过多作废
        </motion.p>
      )}
    </motion.div>
  );
}

export default RevealedNumbers;
