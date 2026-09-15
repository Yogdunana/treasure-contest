/**
 * WaitingRoom - Shown during the LOBBY phase.
 *
 * Displays a waiting state with the current player count and a "waiting
 * for game to start" message.  Also shows the list of connected players
 * so the player knows who else is in the room.
 */

import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { PlayerAvatar } from '../shared/PlayerAvatar';
import { MIN_PLAYERS } from '@treasure-contest/shared';
import { fadeIn, staggerContainer, slideIn } from '../../animations/variants';

export function WaitingRoom() {
  const playerSeats = useGameStore((s) => s.playerSeats);
  const myPlayerId = useGameStore((s) => s.playerId);
  const queueCount = useGameStore((s) => s.queueCount);
  const targetPlayers = useGameStore((s) => s.targetPlayers);

  const playerCount = playerSeats.length;
  const hasEnough = playerCount >= MIN_PLAYERS;
  const isFull = playerCount >= targetPlayers;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex w-full flex-col items-center gap-4 py-6"
    >
      <motion.div variants={fadeIn} className="text-center">
        <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-violet-600/20">
          <svg
            className="h-8 w-8 animate-pulse text-violet-400"
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
        <p className="text-base font-semibold text-slate-200">
          等待游戏开始
        </p>
        <p className="mt-1 text-xs text-slate-500">
          主持人将在玩家齐备后开始游戏
        </p>
      </motion.div>

      {/* Player count */}
      <motion.div
        variants={fadeIn}
        className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-4 py-2"
      >
        <span className="text-sm text-slate-300">
          已加入: {playerCount} / {targetPlayers}
        </span>
        {isFull ? (
          <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] text-emerald-400">
            满员
          </span>
        ) : hasEnough ? (
          <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] text-emerald-400">
            可开始
          </span>
        ) : (
          <span className="rounded-full bg-amber-900/50 px-2 py-0.5 text-[10px] text-amber-400">
            还差 {MIN_PLAYERS - playerCount} 人
          </span>
        )}
      </motion.div>

      {queueCount > 0 && (
        <p className="text-xs text-slate-500">
          另有 {queueCount} 人在排队
        </p>
      )}

      {/* Player list */}
      {playerSeats.length > 0 && (
        <motion.div
          variants={staggerContainer}
          className="flex w-full flex-col gap-1.5"
        >
          <p className="text-xs text-slate-500">在场玩家</p>
          {playerSeats.map((seat) => (
            <motion.div
              key={seat.playerId}
              variants={slideIn}
              className="rounded-lg bg-slate-800/40 px-2 py-1.5"
            >
              <PlayerAvatar
                name={seat.name}
                seatNumber={seat.seatNumber}
                isCurrent={seat.playerId === myPlayerId}
                isConnected={seat.isConnected}
                isReady={seat.isReady}
                size="sm"
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export default WaitingRoom;
