/**
 * Phone UI for MISSION_BRIEFING: private missions + confirm.
 * The projector keeps showing public rules, never these cards.
 */

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { usePlayerActions } from '../../hooks/usePlayerActions';
import { MyMissions } from './MyMissions';
import { fadeIn } from '../../animations/variants';

export function MissionBriefing() {
  const playerSeats = useGameStore((s) => s.playerSeats);
  const playerId = useGameStore((s) => s.playerId);
  const myMissions = useGameStore((s) => s.myMissions);
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
        <h2 className="text-lg font-bold text-amber-300">你的秘密任务</h2>
        <p className="mt-1 text-xs text-slate-500">
          只有你能看见。读完后点确认，全员确认后游戏才开始。
        </p>
      </div>

      {myMissions.length === 0 ? (
        <p className="rounded-xl border border-slate-700 bg-slate-800/50 py-8 text-center text-sm text-slate-500">
          正在发放任务...
        </p>
      ) : (
        <MyMissions />
      )}

      <p className="text-center text-xs text-slate-500">
        已确认 {readyCount} / {playerSeats.length}
      </p>

      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmed || myMissions.length === 0}
        className={clsx(
          'w-full rounded-xl py-3 text-base font-bold transition-colors',
          confirmed
            ? 'cursor-default bg-slate-800 text-slate-500'
            : 'bg-amber-600 text-amber-950 hover:bg-amber-500',
        )}
      >
        {confirmed ? '已确认，等待其他人...' : '我已读完任务'}
      </button>
    </motion.div>
  );
}

export default MissionBriefing;
