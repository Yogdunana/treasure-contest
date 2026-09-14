/**
 * GameOverScreen - GAME_OVER phase display for the big screen.
 *
 * Shows the final ranking (reusing FinalRanking's layout logic) along
 * with the QR code reappearing for next game recruitment.  Displays a
 * "游戏结束" or champion celebration title, and "等待主持人开始新一局..."
 * message.
 *
 * The QR code overlay is rendered by ScreenDisplay during GAME_OVER,
 * so this component focuses on the ranking display and next-game prompt.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useMemo } from 'react';
import { useGameStore } from '../../store/game-store';
import { FinalRanking } from './FinalRanking';
import {
  fadeIn,
  scaleIn,
  championEffect,
} from '../../animations/variants';

export function GameOverScreen() {
  const finalResults = useGameStore((s) => s.finalResults);

  // Find the champion
  const champion = useMemo(() => {
    return finalResults.find((r) => r.finalRank === 1);
  }, [finalResults]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full w-full flex-col"
    >
      {/* Champion celebration banner */}
      {champion && (
        <motion.div
          variants={championEffect}
          initial="hidden"
          animate="visible"
          className="flex justify-center pt-4"
        >
          <motion.div
            className="flex items-center gap-4 rounded-2xl border-2 border-amber-400/60 bg-amber-950/30 px-8 py-4"
            animate={{
              boxShadow: [
                '0 0 30px rgba(251,191,36,0.4)',
                '0 0 60px rgba(251,191,36,0.7)',
                '0 0 30px rgba(251,191,36,0.4)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <motion.span
              className="text-5xl"
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              🏆
            </motion.span>
            <div>
              <p className="text-lg text-amber-300">游戏结束</p>
              <p className="text-3xl font-bold text-amber-200">
                冠军: {champion.name}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Final ranking */}
      <div className="flex-1">
        <FinalRanking />
      </div>

      {/* Bottom: next game prompt */}
      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="flex justify-center pb-6"
      >
        <motion.div
          className="flex items-center gap-3 rounded-full border border-violet-500/40 bg-violet-950/30 px-8 py-3"
          animate={{
            boxShadow: [
              '0 0 0px rgba(139,92,246,0)',
              '0 0 20px rgba(139,92,246,0.3)',
              '0 0 0px rgba(139,92,246,0)',
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <motion.span
            className="flex h-3 w-3"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <span className="block h-3 w-3 rounded-full bg-violet-400" />
          </motion.span>
          <p className="text-xl font-medium text-violet-300">
            等待主持人开始新一局...
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default GameOverScreen;
