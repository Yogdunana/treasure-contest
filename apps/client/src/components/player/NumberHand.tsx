/**
 * NumberHand - Shows the player's available numbers (1-7) as clickable cards.
 *
 * During the NUMBER_SELECTION phase, players pick one of their remaining
 * numbers to submit for the round.  Used numbers are permanently consumed
 * and shown grayed out.  The current round's submission is highlighted with
 * a locked indicator.
 *
 * After submitting, the card shows a "已选" locked state until the phase
 * transitions.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { usePlayerActions } from '../../hooks/usePlayerActions';
import { INITIAL_NUMBERS } from '@treasure-contest/shared';
import { scaleIn } from '../../animations/variants';

export function NumberHand() {
  const availableNumbers = useGameStore((s) => s.availableNumbers);
  const usedNumbers = useGameStore((s) => s.usedNumbers);
  const roundSubmission = useGameStore((s) => s.roundSubmission);

  const { submitNumber } = usePlayerActions();

  const hasSubmitted = roundSubmission !== null;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">选择数字</h3>
        <span className="text-xs text-slate-500">
          点击数字卡提交本轮选择
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {INITIAL_NUMBERS.map((num) => {
          const isUsed = usedNumbers.includes(num);
          const isAvailable = availableNumbers.includes(num);
          const isSubmitted = roundSubmission === num;

          const isDisabled = isUsed || !isAvailable || hasSubmitted;

          return (
            <motion.button
              key={num}
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              transition={{ delay: num * 0.05 }}
              whileTap={!isDisabled ? { scale: 0.92 } : undefined}
              whileHover={!isDisabled ? { scale: 1.05 } : undefined}
              disabled={isDisabled}
              onClick={() => !isDisabled && submitNumber(num)}
              className={clsx(
                'relative flex aspect-square flex-col items-center justify-center rounded-xl text-2xl font-bold transition-all duration-200',
                isSubmitted &&
                  'bg-violet-600 text-white ring-2 ring-violet-300 ring-offset-2 ring-offset-slate-900',
                !isSubmitted &&
                  isAvailable &&
                  !isUsed &&
                  'cursor-pointer bg-slate-700 text-slate-100 hover:bg-slate-600',
                isUsed && 'cursor-not-allowed bg-slate-800 text-slate-600 opacity-40',
                !isAvailable &&
                  !isUsed &&
                  'cursor-not-allowed bg-slate-800 text-slate-600 opacity-40',
                hasSubmitted &&
                  !isSubmitted &&
                  isAvailable &&
                  'cursor-not-allowed bg-slate-700/50 text-slate-500 opacity-60',
              )}
            >
              <span>{num}</span>

              {isSubmitted && (
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-violet-400 px-2 py-0.5 text-[10px] font-medium text-violet-950"
                >
                  已选
                </motion.span>
              )}

              {isUsed && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg opacity-60">✕</span>
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {hasSubmitted && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-center text-sm text-violet-400"
        >
          已提交数字 {roundSubmission}，等待其他玩家...
        </motion.p>
      )}
    </div>
  );
}

export default NumberHand;
