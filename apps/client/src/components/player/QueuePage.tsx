/**
 * QueuePage - Queue waiting page for players when the room is full.
 *
 * Shows the player's queue position, how many people are ahead of them,
 * and room information.  Includes a leave queue button.  When the
 * `queue:promoted` event fires (handled by the socket store), the player
 * is automatically redirected to the game page.
 *
 * This component can be rendered inline within the join page or as a
 * standalone page.
 */

import { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { useQueue } from '../../hooks/useQueue';
import { type GamePhase } from '@treasure-contest/shared';
import { fadeIn, scaleIn, slideUp, staggerContainer } from '../../animations/variants';

/** Human-readable Chinese label for a game phase. */
function phaseLabel(phase: GamePhase): string {
  const labels: Partial<Record<GamePhase, string>> = {
    LOBBY: '等待开始',
    GEM_REVEAL: '展示宝石',
    NUMBER_SELECTION: '选数字中',
    NUMBER_REVEAL: '数字揭晓',
    GEM_SELECTION: '选宝石中',
    ROUND_END: '回合结束',
    RESULTS_REVEAL: '公布结果',
    GAME_OVER: '游戏结束',
  };
  return labels[phase] ?? phase;
}

export interface QueuePageProps {
  /** The room code (defaults to URL param). */
  roomCode?: string;
  /** The player name (for display). */
  playerName?: string;
}

export function QueuePage({ roomCode: propRoomCode, playerName }: QueuePageProps) {
  const navigate = useNavigate();
  const { roomCode: paramRoomCode } = useParams<{ roomCode: string }>();
  const roomCode = propRoomCode ?? paramRoomCode ?? '';

  const queuePosition = useGameStore((s) => s.queuePosition);
  const totalInQueue = useGameStore((s) => s.totalInQueue);
  const seatedCount = useGameStore((s) => s.seatedCount);
  const targetPlayers = useGameStore((s) => s.targetPlayers);
  const phase = useGameStore((s) => s.phase);
  const snapshotRole = useGameStore((s) => s.snapshotRole);
  const snapshotRoomCode = useGameStore((s) => s.snapshotRoomCode);

  const { leaveQueue } = useQueue();

  // Only leave the queue UI after THIS room actually seats us as a player.
  // A leftover playerId from a previous room used to auto-navigate immediately.
  useEffect(() => {
    if (
      snapshotRole === 'player' &&
      roomCode &&
      snapshotRoomCode?.toUpperCase() === roomCode.toUpperCase()
    ) {
      navigate(`/play/${roomCode}/game`);
    }
  }, [snapshotRole, snapshotRoomCode, roomCode, navigate]);

  const handleLeaveQueue = useCallback(() => {
    leaveQueue();
    navigate(`/play/${roomCode}`);
  }, [leaveQueue, navigate, roomCode]);

  const peopleAhead = queuePosition ? queuePosition - 1 : 0;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-950 p-6"
    >
      {/* Queue position card */}
      <motion.div
        variants={scaleIn}
        className="w-full max-w-sm rounded-2xl border border-violet-500/30 bg-slate-800/50 p-6 text-center"
      >
        <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-violet-600/20">
          <span className="text-2xl font-bold text-violet-300">
            #{queuePosition ?? '?'}
          </span>
        </div>

        <p className="text-base font-semibold text-slate-200">
          您在队列中
        </p>
        {queuePosition && (
          <p className="mt-1 text-sm text-slate-400">
            位置: #{queuePosition}
          </p>
        )}
        {peopleAhead > 0 ? (
          <p className="mt-2 text-sm text-amber-400">
            前面还有 {peopleAhead} 人
          </p>
        ) : (
          <p className="mt-2 text-sm text-emerald-400">
            你是下一个！
          </p>
        )}
      </motion.div>

      {/* Room info */}
      <motion.div
        variants={slideUp}
        className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800/50 p-4"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">房间号</span>
          <span className="font-mono text-sm font-bold text-slate-200">
            {roomCode}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">游戏状态</span>
          <span className="text-sm text-violet-300">
            {phaseLabel(phase)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">在场玩家</span>
          <span className="text-sm text-slate-300">
            {seatedCount} / {targetPlayers}
          </span>
        </div>
        {totalInQueue && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">队列总人数</span>
            <span className="text-sm text-slate-300">{totalInQueue}</span>
          </div>
        )}
      </motion.div>

      {/* Info message */}
      <motion.p
        variants={fadeIn}
        className="max-w-sm text-center text-xs text-slate-500"
      >
        当有玩家离开时，队列中的玩家将自动加入游戏。
        请保持此页面打开，系统会自动将您转入游戏。
      </motion.p>

      {/* Leave button */}
      <motion.button
        variants={fadeIn}
        onClick={handleLeaveQueue}
        className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:border-red-700/50 hover:bg-red-900/20 hover:text-red-400"
      >
        离开队列
      </motion.button>

      {playerName && (
        <motion.p variants={fadeIn} className="text-xs text-slate-600">
          当前身份: {playerName}
        </motion.p>
      )}
    </motion.div>
  );
}

export default QueuePage;
