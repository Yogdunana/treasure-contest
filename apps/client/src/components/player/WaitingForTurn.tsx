/**
 * WaitingForTurn - Shown when it is another player's turn to pick a gem.
 *
 * Displays the current picker's name and a waiting message so the player
 * knows the game is progressing and whose turn it is.
 */

import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { fadeIn } from '../../animations/variants';

export function WaitingForTurn() {
  const currentPickerId = useGameStore((s) => s.currentPickerId);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const myPlayerId = useGameStore((s) => s.playerId);

  const picker = playerSeats.find((s) => s.playerId === currentPickerId);
  const pickerName = picker?.name ?? '其他玩家';
  const isMe = currentPickerId === myPlayerId;

  if (isMe) return null;

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col items-center justify-center gap-4 py-12"
    >
      <div className="relative">
        <div className="h-16 w-16 animate-pulse rounded-full bg-violet-600/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="h-8 w-8 animate-spin text-violet-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <p className="text-base font-medium text-slate-200">
          等待其他玩家选宝石...
        </p>
        <p className="mt-1 text-sm text-violet-400">
          当前轮到 <span className="font-bold">{pickerName}</span>
        </p>
      </div>
    </motion.div>
  );
}

export default WaitingForTurn;
