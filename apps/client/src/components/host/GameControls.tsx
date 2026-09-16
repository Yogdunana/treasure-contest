/**
 * GameControls — all host control buttons for managing the game.
 *
 * Provides buttons for:
 * - Starting the game (enabled when >= MIN_PLAYERS and phase is LOBBY)
 * - Pausing / Resuming
 * - Advancing the phase manually
 * - Skipping the current picker (during GEM_SELECTION)
 * - Ending the game early (with confirmation)
 * - Restarting the game (after GAME_OVER, with confirmation)
 *
 * All buttons are contextually enabled/disabled based on the current phase.
 */

import { useState, useCallback } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { useHostControls } from '../../hooks/useHostControls';
import {
  MIN_PLAYERS,
  isBriefingPhase,
  type GamePhase,
} from '@treasure-contest/shared';

type ConfirmAction = 'endGame' | 'restart' | null;

export interface GameControlsProps {
  /** Additional CSS class names. */
  className?: string;
}

/** Tailwind classes for each button style. */
const BTN_BASE =
  'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40';

const BTN_STYLES = {
  start: 'bg-emerald-600 text-white hover:bg-emerald-500',
  pause: 'bg-amber-600 text-white hover:bg-amber-500',
  resume: 'bg-sky-600 text-white hover:bg-sky-500',
  advance: 'bg-violet-600 text-white hover:bg-violet-500',
  skip: 'bg-orange-600 text-white hover:bg-orange-500',
  end: 'bg-rose-600/80 text-white hover:bg-rose-500',
  restart: 'bg-slate-600 text-white hover:bg-slate-500',
} as const;

/** Phases in which the game is actively running (not lobby or game over). */
const ACTIVE_PHASES: GamePhase[] = [
  'GAME_INIT',
  'RULES_BRIEFING',
  'MISSION_BRIEFING',
  'ROUND_START',
  'GEM_REVEAL',
  'NUMBER_SELECTION',
  'NUMBER_REVEAL',
  'ORDER_CALCULATION',
  'GEM_SELECTION',
  'ROUND_END',
  'FINAL_CALCULATION',
  'RESULTS_REVEAL',
];

function GameControlsComponent({ className }: GameControlsProps) {
  const phase = useGameStore((s) => s.phase);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const currentPickerId = useGameStore((s) => s.currentPickerId);
  const {
    startGame,
    pause,
    resume,
    advancePhase,
    skipPlayer,
    endGame,
    restart,
  } = useHostControls();

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const playerCount = playerSeats.filter((p) => p.isConnected).length;
  const canStart = phase === 'LOBBY' && playerCount >= MIN_PLAYERS;
  const isPaused = phase === 'PAUSED';
  const isActive = ACTIVE_PHASES.includes(phase) || isPaused;
  const canAdvance = isActive && !isPaused;
  const canSkip = phase === 'GEM_SELECTION' && currentPickerId !== null;
  const canEnd = phase !== 'LOBBY' && phase !== 'GAME_OVER';
  const canRestart = phase === 'GAME_OVER';

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'endGame') {
      endGame();
    } else if (confirmAction === 'restart') {
      restart();
    }
    setConfirmAction(null);
  }, [confirmAction, endGame, restart]);

  const confirmLabel =
    confirmAction === 'endGame' ? '结束游戏' : '重新开始';

  const confirmDesc =
    confirmAction === 'endGame'
      ? '确定要提前结束游戏吗？所有当前进度将停止并进入结算阶段。'
      : '确定要重新开始游戏吗？当前房间将重置，玩家需要重新加入。';

  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-700 bg-slate-800/50 p-4',
        className,
      )}
    >
      <h3 className="mb-3 text-sm font-semibold text-slate-300">
        游戏控制
      </h3>

      {/* Primary actions */}
      <div className="grid grid-cols-2 gap-2">
        {/* Start Game */}
        <button
          onClick={() => startGame()}
          disabled={!canStart}
          className={clsx(BTN_BASE, BTN_STYLES.start)}
          title={canStart ? '开始游戏' : `需要至少 ${MIN_PLAYERS} 名玩家`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
          </svg>
          开始游戏
        </button>

        {/* Pause / Resume */}
        {isPaused ? (
          <button
            onClick={() => resume()}
            className={clsx(BTN_BASE, BTN_STYLES.resume)}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
            继续游戏
          </button>
        ) : (
          <button
            onClick={() => pause()}
            disabled={!isActive}
            className={clsx(BTN_BASE, BTN_STYLES.pause)}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 4h3v16H8zM13 4h3v16h-3z" />
            </svg>
            暂停
          </button>
        )}

        {/* Advance Phase */}
        <button
          onClick={() => advancePhase()}
          disabled={!canAdvance}
          className={clsx(BTN_BASE, BTN_STYLES.advance)}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          推进阶段
        </button>

        {/* Skip Player */}
        <button
          onClick={() => currentPickerId && skipPlayer(currentPickerId)}
          disabled={!canSkip}
          className={clsx(BTN_BASE, BTN_STYLES.skip)}
          title={canSkip ? '跳过当前选择者' : '仅在宝石选择阶段可用'}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          跳过玩家
        </button>

        {/* End Game */}
        <button
          onClick={() => setConfirmAction('endGame')}
          disabled={!canEnd}
          className={clsx(BTN_BASE, BTN_STYLES.end)}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          结束游戏
        </button>

        {/* Restart */}
        <button
          onClick={() => setConfirmAction('restart')}
          disabled={!canRestart}
          className={clsx(BTN_BASE, BTN_STYLES.restart)}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 8A8 8 0 005.3 7.3M4 16a8 8 0 0014.7 0.7" />
          </svg>
          重新开始
        </button>
      </div>

      {/* Status hint */}
      <div className="mt-3 rounded-lg bg-slate-900/50 px-3 py-2 text-center text-[11px] text-slate-500">
        {phase === 'LOBBY' && playerCount < MIN_PLAYERS && (
          <span>等待玩家加入 ({playerCount}/{MIN_PLAYERS})</span>
        )}
        {phase === 'LOBBY' && playerCount >= MIN_PLAYERS && (
          <span className="text-emerald-400">可以开始游戏了</span>
        )}
        {isBriefingPhase(phase) && (
          <span className="text-violet-300">
            {phase === 'MISSION_BRIEFING' ? '等待玩家确认任务' : '等待玩家确认规则'}
            {' '}
            ({playerSeats.filter((p) => p.isReady).length}/{playerSeats.length})
            ，可不点「推进阶段」跳过
          </span>
        )}
        {phase === 'GEM_SELECTION' && currentPickerId && (
          <span className="text-orange-400">正在宝石选择中</span>
        )}
        {phase === 'PAUSED' && (
          <span className="text-amber-400">游戏已暂停</span>
        )}
        {phase === 'GAME_OVER' && (
          <span className="text-slate-400">游戏已结束</span>
        )}
        {phase !== 'LOBBY' &&
          !isBriefingPhase(phase) &&
          phase !== 'GEM_SELECTION' &&
          phase !== 'PAUSED' &&
          phase !== 'GAME_OVER' && (
            <span className="text-slate-400">游戏进行中</span>
          )}
      </div>

      {/* Confirmation dialog */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmAction(null)}
          >
            <motion.div
              className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-2xl"
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="mb-2 text-base font-bold text-slate-100">
                确认{confirmLabel}
              </h4>
              <p className="mb-4 text-sm text-slate-400">{confirmDesc}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirm}
                  className={clsx(
                    'flex-1 rounded-lg px-4 py-2 text-sm font-bold text-white',
                    confirmAction === 'endGame'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-violet-600 hover:bg-violet-500',
                  )}
                >
                  确认{confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GameControlsComponent;
