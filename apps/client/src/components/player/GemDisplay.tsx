/**
 * GemDisplay - Shows the 4 gems for the current round during GEM_REVEAL.
 *
 * Each gem is rendered with a reveal animation, showing its color and
 * value.  This is a display-only component — players cannot interact with
 * gems during this phase.
 */

import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { GemIcon } from '../shared/GemIcon';
import { GEM_COLOR_LABELS } from '@treasure-contest/shared';
import { gemReveal, staggerContainer } from '../../animations/variants';

export function GemDisplay() {
  const gems = useGameStore((s) => s.gems);
  const currentRound = useGameStore((s) => s.currentRound);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex w-full flex-col items-center gap-4"
    >
      <motion.div variants={gemReveal} className="text-center">
        <p className="text-base font-semibold text-violet-300">
          第 {currentRound} 轮宝石
        </p>
        <p className="mt-1 text-xs text-slate-500">
          记住这些宝石，选择数字时考虑你想获得哪一颗
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {gems.map((gem) => (
          <motion.div
            key={gem.id}
            variants={gemReveal}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/50 p-3"
          >
            <GemIcon color={gem.color} size={48} value={gem.value} />
            <div className="text-center">
              <p className="text-xs text-slate-400">
                {GEM_COLOR_LABELS[gem.color]}
              </p>
              <p className="text-sm font-bold text-slate-100">
                {gem.value} 分
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default GemDisplay;
