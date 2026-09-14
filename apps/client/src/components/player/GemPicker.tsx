/**
 * GemPicker - Gem selection interface for the GEM_SELECTION phase.
 *
 * Shows the 4 gems (or remaining gems) for the current round as large
 * clickable cards.  When it is the player's turn, a CountdownRing counts
 * down from 5 seconds.  Clicking a gem calls `selectGem(gemId)`.
 *
 * Already-picked gems are dimmed and disabled.
 */

import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { useGamePhase } from '../../hooks/useGamePhase';
import { usePlayerActions } from '../../hooks/usePlayerActions';
import { GemIcon } from '../shared/GemIcon';
import { CountdownRing } from '../shared/CountdownRing';
import {
  TIMING_CONFIG,
  GEM_COLOR_LABELS,
} from '@treasure-contest/shared';
import { gemReveal, staggerContainer } from '../../animations/variants';

export function GemPicker() {
  const gems = useGameStore((s) => s.gems);
  const timer = useGameStore((s) => s.timer);
  const { isMyTurn } = useGamePhase();
  const { selectGem } = usePlayerActions();

  const totalSeconds = TIMING_CONFIG.GEM_PICK_SECONDS_PER_PLAYER;
  const remainingSeconds = timer
    ? Math.ceil(timer.remaining / 1000)
    : totalSeconds;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex w-full flex-col items-center gap-4"
    >
      {/* Countdown */}
      {isMyTurn && (
        <CountdownRing
          seconds={remainingSeconds}
          totalSeconds={totalSeconds}
          size={72}
          strokeWidth={5}
        />
      )}

      {/* Instruction text */}
      <div className="text-center">
        {isMyTurn ? (
          <p className="text-base font-semibold text-violet-300">
            轮到你了！选择一颗宝石
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            等待当前玩家选择宝石...
          </p>
        )}
      </div>

      {/* Gem cards */}
      <motion.div
        variants={staggerContainer}
        className="grid w-full grid-cols-2 gap-3"
      >
        <AnimatePresence mode="popLayout">
          {gems.map((gem) => {
            const isPicked = gem.pickedBy !== undefined;
            const isDisabled = isPicked || !isMyTurn;

            return (
              <motion.button
                key={gem.id}
                variants={gemReveal}
                initial="hidden"
                animate="visible"
                exit="exit"
                whileTap={!isDisabled ? { scale: 0.95 } : undefined}
                whileHover={!isDisabled ? { scale: 1.03 } : undefined}
                disabled={isDisabled}
                onClick={() => !isDisabled && selectGem(gem.id)}
                className={clsx(
                  'relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200',
                  isPicked
                    ? 'border-slate-700 bg-slate-800/50 opacity-40'
                    : isMyTurn
                      ? 'border-violet-500/50 bg-slate-800 hover:border-violet-400 hover:bg-slate-700'
                      : 'border-slate-700 bg-slate-800 opacity-60',
                )}
              >
                <GemIcon
                  color={gem.color}
                  size={56}
                  value={gem.value}
                  picked={isPicked}
                />
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-300">
                    {GEM_COLOR_LABELS[gem.color]}
                  </p>
                  <p className="text-sm font-bold text-slate-100">
                    {gem.value} 分
                  </p>
                </div>

                {isPicked && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/60">
                    <span className="text-2xl">✓</span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default GemPicker;
