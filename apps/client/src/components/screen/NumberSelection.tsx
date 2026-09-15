/**
 * NumberSelection - NUMBER_SELECTION phase display for the big screen.
 *
 * Seats sit on a ring around a countdown timer.  Remaining seconds stay
 * inside the ring; submitted count is a separate label under it so the
 * two numbers never overlap.  Each player shows "选择中..." or "已提交".
 */

import { motion } from 'framer-motion';
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

  const submittedCount = playerSeats.filter((seat) => seat.isReady).length;
  const count = playerSeats.length;
  const radius =
    count <= 4 ? 230 : count === 5 ? 248 : count === 6 ? 262 : 272;
  const ringSize = count >= 7 ? 128 : 148;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex h-full min-h-0 w-full flex-col items-center overflow-hidden"
    >
      <motion.div variants={fadeIn} className="shrink-0 pt-2 text-center">
        <h2 className="text-4xl font-bold text-violet-300" style={{ textShadow: '0 0 30px rgba(139,92,246,0.6)' }}>
          数字选择
        </h2>
        <p className="mt-1 text-xl text-slate-400">
          每位玩家从 1-7 中选择一个数字
        </p>
      </motion.div>

      <div className="relative min-h-0 w-full flex-1">
        <PlayerSeats
          layout="circle"
          showSubmissionStatus
          radius={radius}
          className="h-full"
        />

        <motion.div
          variants={scaleIn}
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          <CountdownRing
            seconds={remainingSeconds}
            totalSeconds={totalSeconds}
            size={ringSize}
            strokeWidth={count >= 7 ? 8 : 10}
          />
          <p className="mt-2 text-lg text-slate-400">
            <motion.span
              key={submittedCount}
              className="text-2xl font-bold tabular-nums text-slate-100"
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            >
              {submittedCount}
            </motion.span>
            <span> / {playerSeats.length} 已提交</span>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default NumberSelection;
