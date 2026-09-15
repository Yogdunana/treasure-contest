/**
 * QueuePanel — waiting queue management for the host.
 *
 * Shows the total queue count, a list of queued players with their position
 * and join time, and buttons to promote or remove each entry.  An empty
 * state is shown when no one is queued.  The panel is only active during
 * the LOBBY and GAME_OVER phases.
 */

import { memo } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { useHostControls } from '../../hooks/useHostControls';
import { slideIn } from '../../animations/variants';
import type { QueueEntry } from '@treasure-contest/shared';

/** Formats an ISO timestamp to a short HH:MM:SS string. */
function formatJoinTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--';
  }
}

/** Renders a single queue entry row. */
function QueueRow({ entry, canPromote }: { entry: QueueEntry; canPromote: boolean }) {
  const { promotePlayer, removeFromQueue } = useHostControls();

  return (
    <motion.div
      variants={slideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={clsx(
        'flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1.5',
      )}
    >
      {/* Position badge */}
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600/30 text-[10px] font-bold text-sky-400">
        {entry.position}
      </span>

      {/* Name + join time */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium text-slate-200">
          {entry.playerName}
        </span>
        <span className="text-[10px] text-slate-600">
          {formatJoinTime(entry.joinedAt)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => canPromote && promotePlayer(entry.id)}
          disabled={!canPromote}
          className="rounded bg-emerald-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          title={canPromote ? '提升为正式玩家' : '仅大厅可提升入座'}
        >
          提升
        </button>
        <button
          onClick={() => removeFromQueue(entry.id)}
          className="rounded bg-rose-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white transition-colors hover:bg-rose-500"
          title="从队列移除"
        >
          移除
        </button>
      </div>
    </motion.div>
  );
}

function QueuePanelComponent() {
  const phase = useGameStore((s) => s.phase);
  const queueList = useGameStore((s) => s.queueList);

  // Promote into a seat is only allowed in LOBBY (server-enforced).
  const isActive = phase === 'LOBBY';

  return (
    <div
      className={clsx(
        'rounded-xl border p-4 transition-opacity',
        isActive
          ? 'border-slate-700 bg-slate-800/40'
          : 'border-slate-800 bg-slate-900/30 opacity-50',
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">
          等待队列
        </h3>
        <span
          className={clsx(
            'rounded-full px-2 py-0.5 text-[10px] font-bold',
            queueList.length > 0
              ? 'bg-sky-600/30 text-sky-400'
              : 'bg-slate-700 text-slate-500',
          )}
        >
          {queueList.length}
        </span>
      </div>

      {/* Queue list */}
      {queueList.length === 0 ? (
        <div className="flex h-20 items-center justify-center text-xs text-slate-600">
          {isActive ? '队列为空' : '游戏进行中不可提升入座'}
        </div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence>
            {queueList.map((entry) => (
              <QueueRow key={entry.id} entry={entry} canPromote={isActive} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Queue info */}
      {queueList.length > 0 && !isActive && (
        <p className="mt-2 text-center text-[10px] text-amber-500/70">
          游戏进行中，队列操作已禁用
        </p>
      )}
    </div>
  );
}

export const QueuePanel = memo(QueuePanelComponent);
export default QueuePanel;
