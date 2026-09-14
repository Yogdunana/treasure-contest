/**
 * GemReveal - GEM_REVEAL phase display for the big screen.
 *
 * Shows 4 gems appearing with stagger animation.  Each gem pops in with
 * a scale+rotate effect, is large and prominent with glow effects, and
 * displays color + value clearly.
 *
 * The server auto-advances after the GEM_REVEAL_DELAY_MS (3 seconds),
 * so no client-side timer is needed.
 */

import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { GemIcon } from '../shared/GemIcon';
import {
  GEM_COLOR_LABELS,
  GEMS_PER_ROUND,
} from '@treasure-contest/shared';
import { gemReveal, staggerContainer, fadeIn } from '../../animations/variants';

export function GemReveal() {
  const gems = useGameStore((s) => s.gems);
  const currentRound = useGameStore((s) => s.currentRound);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex h-full w-full flex-col items-center justify-center gap-10"
    >
      {/* Title */}
      <motion.div variants={fadeIn} className="text-center">
        <motion.h2
          className="text-5xl font-bold text-violet-300"
          style={{ textShadow: '0 0 30px rgba(139,92,246,0.6)' }}
          animate={{ scale: [1, 1.03, 1] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          本轮宝石
        </motion.h2>
        <p className="mt-2 text-2xl text-slate-400">
          第 {currentRound} 轮 · 共 {GEMS_PER_ROUND} 颗
        </p>
      </motion.div>

      {/* Gem display grid */}
      <motion.div
        variants={staggerContainer}
        className="flex items-center justify-center gap-8"
      >
        {gems.map((gem, index) => (
          <motion.div
            key={gem.id}
            variants={gemReveal}
            className="flex flex-col items-center gap-4"
          >
            {/* Gem container with glow */}
            <motion.div
              className={`gem-${gem.color} relative flex items-center justify-center rounded-3xl`}
              style={{
                padding: '2rem',
              }}
              animate={{
                boxShadow: [
                  `0 0 30px var(--gem-glow)`,
                  `0 0 60px var(--gem-glow)`,
                  `0 0 30px var(--gem-glow)`,
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: index * 0.15,
              }}
            >
              <GemIcon color={gem.color} size={140} value={gem.value} />

              {/* Sparkle effect */}
              <motion.span
                className="absolute -right-2 -top-2 text-3xl"
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.5, 1.2, 0.5],
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: index * 0.15 + 0.5,
                  ease: 'easeInOut',
                }}
              >
                ✨
              </motion.span>
            </motion.div>

            {/* Gem info */}
            <div className="text-center">
              <p className="text-2xl font-semibold text-slate-200">
                {GEM_COLOR_LABELS[gem.color]}
              </p>
              <p className="text-4xl font-bold text-amber-400">
                {gem.value}
                <span className="ml-1 text-xl text-slate-400">分</span>
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Hint message */}
      <motion.p
        variants={fadeIn}
        className="text-xl text-slate-500"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        记住这些宝石，选数字时考虑你想获得哪一颗
      </motion.p>
    </motion.div>
  );
}

export default GemReveal;
