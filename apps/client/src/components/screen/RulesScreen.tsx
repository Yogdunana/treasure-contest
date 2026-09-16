/**
 * Opening briefing on the projector: always the public rules.
 * Phones show secret missions separately; this screen never does.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { GameRules } from '../shared/GameRules';
import { fadeIn, staggerContainer } from '../../animations/variants';

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

export function RulesScreen() {
  const phase = useGameStore((s) => s.phase);
  const pausedPhase = useGameStore((s) => s.pausedPhase);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const viewPhase = phase === 'PAUSED' && pausedPhase ? pausedPhase : phase;
  const readingMissions = viewPhase === 'MISSION_BRIEFING';
  const readyCount = playerSeats.filter((seat) => seat.isReady).length;
  const sorted = [...playerSeats].sort((a, b) => a.seatNumber - b.seatNumber);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex h-full w-full flex-col px-4 py-2"
    >
      <motion.div variants={fadeIn} className="shrink-0 text-center">
        <h2
          className="text-4xl font-bold text-violet-300"
          style={{ textShadow: '0 0 30px rgba(139,92,246,0.6)' }}
        >
          游戏规则
        </h2>
        <p className="mt-2 text-xl text-slate-400">
          {readingMissions
            ? '请在手机上阅读自己的秘密任务并确认（任务不会显示在大屏上）'
            : '请在手机上阅读规则，读完后点确认'}
        </p>
      </motion.div>

      <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/60 px-8 py-5">
        <GameRules />
      </div>

      <motion.div
        variants={fadeIn}
        className="mt-3 flex shrink-0 flex-col items-center gap-2"
      >
        <p className="text-lg text-slate-400">
          已确认{' '}
          <span className="text-2xl font-bold tabular-nums text-slate-100">
            {readyCount}
          </span>{' '}
          / {playerSeats.length}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {sorted.map((seat) => (
            <div
              key={seat.playerId}
              className={clsx(
                'flex items-center gap-2 rounded-full border px-3 py-1.5',
                seat.isReady
                  ? 'border-emerald-500/50 bg-emerald-950/40'
                  : 'border-slate-600 bg-slate-800/60',
              )}
            >
              <span
                className={clsx(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white',
                  SEAT_BG[(seat.seatNumber - 1) % SEAT_BG.length],
                )}
              >
                {seat.seatNumber}
              </span>
              <span className="max-w-[7rem] truncate text-sm font-semibold text-slate-100">
                {seat.name}
              </span>
              <span
                className={clsx(
                  'text-xs font-bold',
                  seat.isReady ? 'text-emerald-400' : 'text-slate-500',
                )}
              >
                {seat.isReady ? '已确认' : '阅读中'}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default RulesScreen;
