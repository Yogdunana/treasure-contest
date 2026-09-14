/**
 * PhaseTracker — shows the current game phase and phase history.
 *
 * Displays the full ordered list of game phases, highlighting the current
 * phase and showing checkmarks for completed phases.  Also shows the
 * current round number (1-6).
 */

import { memo } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import {
  PHASE_ORDER,
  TOTAL_ROUNDS,
  type GamePhase,
} from '@treasure-contest/shared';

/** Chinese labels for each game phase. */
const PHASE_LABELS: Record<GamePhase, string> = {
  LOBBY: '大厅等待',
  GAME_INIT: '游戏初始化',
  ROUND_START: '回合开始',
  GEM_REVEAL: '宝石展示',
  NUMBER_SELECTION: '数字选择',
  NUMBER_REVEAL: '数字揭示',
  ORDER_CALCULATION: '顺序计算',
  GEM_SELECTION: '宝石选择',
  ROUND_END: '回合结束',
  FINAL_CALCULATION: '最终结算',
  RESULTS_REVEAL: '结果展示',
  GAME_OVER: '游戏结束',
  PAUSED: '已暂停',
};

export interface PhaseTrackerProps {
  /** Additional CSS class names. */
  className?: string;
}

function PhaseTrackerComponent({ className }: PhaseTrackerProps) {
  const phase = useGameStore((s) => s.phase);
  const currentRound = useGameStore((s) => s.currentRound);

  // PAUSED is a special case — find the "real" phase position
  const effectivePhase: GamePhase = phase === 'PAUSED' ? 'PAUSED' : phase;
  const currentIndex = PHASE_ORDER.indexOf(
    phase === 'PAUSED' ? 'PAUSED' : phase,
  );

  // For PAUSED, show the last non-paused phase as "in progress"
  const displayIndex =
    phase === 'PAUSED'
      ? PHASE_ORDER.length // treat as "all complete" for visual purposes
      : currentIndex;

  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-700 bg-slate-800/50 p-4',
        className,
      )}
    >
      {/* Header: round + phase */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">阶段追踪</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">回合</span>
          <motion.span
            key={currentRound}
            className={clsx(
              'rounded-full px-2 py-0.5 text-xs font-bold',
              currentRound > 0
                ? 'bg-violet-600/30 text-violet-300'
                : 'bg-slate-700 text-slate-500',
            )}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
          >
            {currentRound > 0 ? `${currentRound}/${TOTAL_ROUNDS}` : '--'}
          </motion.span>
        </div>
      </div>

      {/* Phase list */}
      <ol className="space-y-1">
        {PHASE_ORDER.map((p, idx) => {
          const isCurrent = p === effectivePhase && phase !== 'PAUSED';
          const isCompleted = idx < displayIndex;
          const isPausedIndicator = phase === 'PAUSED' && p === effectivePhase;

          return (
            <li
              key={p}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors',
                isCurrent &&
                  'bg-violet-600/20 ring-1 ring-violet-500/40',
                isPausedIndicator &&
                  'bg-amber-600/20 ring-1 ring-amber-500/40',
                !isCurrent &&
                  !isCompleted &&
                  !isPausedIndicator &&
                  'text-slate-500',
                isCompleted && 'text-slate-600',
              )}
            >
              {/* Status icon */}
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {isCompleted ? (
                  <svg
                    className="h-3.5 w-3.5 text-emerald-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : isCurrent || isPausedIndicator ? (
                  <motion.span
                    className="h-2 w-2 rounded-full bg-violet-400"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                ) : (
                  <span className="h-2 w-2 rounded-full border border-slate-600" />
                )}
              </span>

              {/* Phase label */}
              <span
                className={clsx(
                  'flex-1',
                  (isCurrent || isPausedIndicator) && 'font-semibold text-slate-200',
                )}
              >
                {PHASE_LABELS[p]}
              </span>

              {/* Paused badge */}
              {isPausedIndicator && (
                <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  暂停
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const PhaseTracker = memo(PhaseTrackerComponent);
export default PhaseTracker;
