/**
 * MyGems - Shows the player's collected gems organized by color.
 *
 * Gems are grouped by color, with each group showing the count and total
 * value.  Individual gems display their color and value via the GemIcon
 * component.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { GemIcon } from '../shared/GemIcon';
import {
  GEM_COLORS,
  GEM_COLOR_LABELS,
  type GemColor,
} from '@treasure-contest/shared';
import { slideIn, staggerContainer } from '../../animations/variants';

/** Groups gems by color and returns an array of color groups. */
function groupGemsByColor(gems: { id: string; color: GemColor; value: number }[]) {
  const groups: Record<
    GemColor,
    { gems: { id: string; color: GemColor; value: number }[] }
  > = {
    red: { gems: [] },
    blue: { gems: [] },
    green: { gems: [] },
    yellow: { gems: [] },
    purple: { gems: [] },
  };

  for (const gem of gems) {
    groups[gem.color].gems.push(gem);
  }

  return GEM_COLORS.map((color) => ({
    color,
    gems: groups[color].gems,
  })).filter((g) => g.gems.length > 0);
}

export function MyGems() {
  const myGems = useGameStore((s) => s.myGems);

  const colorGroups = groupGemsByColor(myGems);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">我的宝石</h3>
        <span className="text-xs text-slate-500">
          共 {myGems.length} 颗
        </span>
      </div>

      {myGems.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-600">
          尚未获得宝石
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-2"
        >
          {colorGroups.map((group) => {
            const totalValue = group.gems.reduce(
              (sum, g) => sum + g.value,
              0,
            );
            return (
              <motion.div
                key={group.color}
                variants={slideIn}
                className={clsx(
                  'rounded-lg border border-slate-700 bg-slate-800/50 p-2.5',
                )}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    {GEM_COLOR_LABELS[group.color]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {group.gems.length} 颗 · {totalValue} 分
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.gems.map((gem) => (
                    <div
                      key={gem.id}
                      className={clsx(
                        'flex items-center gap-1 rounded-md bg-slate-900/60 px-1.5 py-1',
                      )}
                    >
                      <GemIcon
                        color={gem.color}
                        size={24}
                        value={gem.value}
                        variant="emoji"
                      />
                      <span className="text-xs font-bold text-slate-200">
                        {gem.value}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

export default MyGems;
