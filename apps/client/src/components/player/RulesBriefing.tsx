/**
 * Phone UI for RULES_BRIEFING: public rules + confirm button.
 */

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { usePlayerActions } from '../../hooks/usePlayerActions';
import { GameRules } from '../shared/GameRules';
import { fadeIn } from '../../animations/variants';

export function RulesBriefing() {
  const playerSeats = useGameStore((s) => s.playerSeats);
  const playerId = useGameStore((s) => s.playerId);
  const { confirmBriefing } = usePlayerActions();
  const me = playerSeats.find((seat) => seat.playerId === playerId);
  const confirmed = Boolean(me?.isReady);
  const readyCount = playerSeats.filter((seat) => seat.isReady).length;

  const onConfirm = useCallback(() => {
    confirmBriefing();
  }, [confirmBriefing]);

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="flex w-full flex-col gap-4"
    >
      <div className="text-center">
        <h2 className="text-lg font-bold text-violet-300">先看规则</h2>
        <p className="mt-1 text-xs text-slate-500">
          读完后点确认。全员确认后才会看到你的秘密任务。
        </p>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
        <GameRules compact />
      </div>

      <p className="text-center text-xs text-slate-500">
        已确认 {readyCount} / {playerSeats.length}
      </p>

      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmed}
        className={clsx(
          'w-full rounded-xl py-3 text-base font-bold transition-colors',
          confirmed
            ? 'cursor-default bg-slate-800 text-slate-500'
            : 'bg-violet-600 text-white hover:bg-violet-500',
        )}
      >
        {confirmed ? '已确认，等待其他人...' : '我已读完规则'}
      </button>
    </motion.div>
  );
}

export default RulesBriefing;
