/**
 * NumberSelection - NUMBER_SELECTION phase display for the big screen.
 *
 * Shows all player seats in a circle/grid layout.  Each player shows
 * "选择中..." or "已锁定" status.  A large countdown timer (15 seconds)
 * is displayed in the center.  Shows how many players have submitted
 * (e.g., "3/6 已提交").  Players who submitted show a lock icon.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { CountdownRing } from '../shared/CountdownRing';
import { PlayerSeats } from './PlayerSeats';
import {
  TIMING_CONFIG,
} from '@treasure-contest/shared';
import {
  fadeIn,
  scaleIn,
  staggerContainer,
} from '../../animations/variants';

export function NumberSelection() {
  const timer = useGameStore((s) => s.timer);
  const playerSeats = useGameStore((s) => s.playerSeats);

  const totalSeconds = TIMING_CONFIG.NUMBER_SELECTION_SECONDS;
  const remainingSeconds = timer
    ? Math.ceil(timer.remaining / 1000)
    : totalSeconds;

  // Count how many players have submitted (number is revealed in the store
  // during NUMBER_REVEAL, but during NUMBER_SELECTION we check the
  // revealedNumbers map for non-null entries)
  const submittedCount = playerSeats.filter((seat) => seat.isReady).length;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex h-full w-full flex-col items-center justify-center gap-6"
    >
      {/* Title */}
      <motion.div variants={fadeIn} className="text-center">
        <h2 className="text-5xl font-bold text-violet-300" style={{ textShadow: '0 0 30px rgba(139,92,246,0.6)' }}>
          数字选择
        </h2>
        <p className="mt-2 text-2xl text-slate-400">
          每位玩家从 1-7 中选择一个数字
        </p>
      </motion.div>

      {/* Center countdown + submission count */}
      <motion.div
        variants={scaleIn}
        className="relative flex items-center justify-center"
      >
        {/* Countdown ring */}
        <CountdownRing
          seconds={remainingSeconds}
          totalSeconds={totalSeconds}
          size={200}
          strokeWidth={12}
        />

        {/* Submission count inside the ring */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={submittedCount}
            className="text-6xl font-bold text-slate-100"
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          >
            {submittedCount}
          </motion.span>
          <span className="text-2xl text-slate-500">
            / {playerSeats.length}
          </span>
          <span className="mt-1 text-sm text-slate-400">已提交</span>
        </div>
      </motion.div>

      {/* Player seats in a circle */}
      <div className="flex w-full justify-center">
        <PlayerSeats
          layout="circle"
          showSubmissionStatus
          className="h-[520px] max-w-[1000px]"
        />
      </div>
    </motion.div>
  );
}

export default NumberSelection;
