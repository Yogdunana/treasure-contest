/**
 * GameOverScreen - GAME_OVER phase display for the big screen.
 *
 * Compact ranking (so 4–8 rows stay on a 1080p TV) plus a next-game prompt.
 * The floating QR overlay is rendered by ScreenDisplay.
 */

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useGameStore } from '../../store/game-store';
import { FinalRanking } from './FinalRanking';
import { fadeIn } from '../../animations/variants';

export function GameOverScreen() {
  const finalResults = useGameStore((s) => s.finalResults);

  const champions = useMemo(
    () => finalResults.filter((r) => r.finalRank === 1),
    [finalResults],
  );

  const championLabel =
    champions.length > 1
      ? `并列冠军: ${champions.map((c) => c.name).join('、')}`
      : champions[0]
        ? `冠军: ${champions[0].name}`
        : '';

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {championLabel && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="flex shrink-0 justify-center pt-2"
        >
          <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-400/60 bg-amber-950/30 px-6 py-3">
            <span className="text-4xl">🏆</span>
            <div>
              <p className="text-sm text-amber-300">游戏结束</p>
              <p className="text-2xl font-bold text-amber-200">{championLabel}</p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="min-h-0 flex-1 px-4">
        <FinalRanking compact />
      </div>

      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="flex shrink-0 justify-center pb-4 pt-2"
      >
        <div className="flex items-center gap-3 rounded-full border border-violet-500/40 bg-violet-950/30 px-8 py-2.5">
          <span className="block h-3 w-3 rounded-full bg-violet-400" />
          <p className="text-lg font-medium text-violet-300">
            等待主持人开始新一局...
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default GameOverScreen;
