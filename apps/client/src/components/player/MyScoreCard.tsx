/**
 * MyScoreCard - Shows the player's current score breakdown.
 *
 * Displays:
 * - Base score (sum of collected gem values)
 * - Color bonus preview (potential bonuses per color)
 * - Total score (base + color bonuses)
 *
 * The color bonus preview uses the COLOR_BONUS_TABLE to show the bonus
 * tier the player has reached for each color.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import {
  GEM_COLORS,
  GEM_COLOR_LABELS,
  COLOR_BONUS_TABLE,
  type GemColor,
} from '@treasure-contest/shared';
import { fadeIn, staggerContainer } from '../../animations/variants';

/** Computes the count of gems per color. */
function getColorCounts(gems: { color: GemColor }[]): Record<GemColor, number> {
  const counts: Record<GemColor, number> = {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0,
    purple: 0,
  };
  for (const gem of gems) {
    counts[gem.color]++;
  }
  return counts;
}

/** Returns the bonus for a given gem count using the tier table. */
function getBonusForCount(count: number): number {
  const tiers = Object.keys(COLOR_BONUS_TABLE)
    .map(Number)
    .sort((a, b) => b - a);
  for (const tier of tiers) {
    if (count >= tier) {
      return COLOR_BONUS_TABLE[tier];
    }
  }
  return 0;
}

export function MyScoreCard() {
  const myGems = useGameStore((s) => s.myGems);
  const myBaseScore = useGameStore((s) => s.myBaseScore);
  const myColorBonuses = useGameStore((s) => s.myColorBonuses);
  const myFinalScore = useGameStore((s) => s.myFinalScore);

  const colorCounts = getColorCounts(myGems);

  // Use myColorBonuses from server if available, otherwise compute locally
  const bonusSource =
    myColorBonuses.length > 0
      ? myColorBonuses
      : GEM_COLORS.filter((c) => colorCounts[c] > 0).map((color) => ({
          color,
          count: colorCounts[color],
          bonus: getBonusForCount(colorCounts[color]),
        }));

  const totalBonus = bonusSource.reduce((sum, b) => sum + b.bonus, 0);
  const totalScore = myFinalScore ?? myBaseScore + totalBonus;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-3"
    >
      <h3 className="mb-2 text-sm font-semibold text-slate-200">我的积分</h3>

      {/* Base score */}
      <motion.div
        variants={fadeIn}
        className="mb-2 flex items-center justify-between"
      >
        <span className="text-xs text-slate-400">基础分</span>
        <span className="text-sm font-bold text-slate-200">
          {myBaseScore}
        </span>
      </motion.div>

      {/* Color bonus preview */}
      {bonusSource.length > 0 && (
        <motion.div variants={fadeIn} className="mb-2 border-t border-slate-700 pt-2">
          <p className="mb-1 text-xs text-slate-400">颜色加成</p>
          <div className="flex flex-col gap-1">
            {bonusSource.map((bonus) => (
              <div
                key={bonus.color}
                className="flex items-center justify-between"
              >
                <span className="text-xs text-slate-300">
                  {GEM_COLOR_LABELS[bonus.color]} ×{bonus.count}
                </span>
                <span
                  className={clsx(
                    'text-xs font-medium',
                    bonus.bonus > 0 ? 'text-emerald-400' : 'text-slate-500',
                  )}
                >
                  {bonus.bonus > 0 ? `+${bonus.bonus}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Total score */}
      <motion.div
        variants={fadeIn}
        className="flex items-center justify-between border-t border-slate-700 pt-2"
      >
        <span className="text-sm font-semibold text-slate-200">总分</span>
        <span className="text-xl font-bold text-violet-300">
          {totalScore}
        </span>
      </motion.div>
    </motion.div>
  );
}

export default MyScoreCard;
