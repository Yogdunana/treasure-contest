/**
 * PausedOverlay - Full-screen overlay shown when the game is paused.
 *
 * Displays a semi-transparent dark background with an animated pause icon,
 * "游戏暂停" title, and "等待主持人恢复..." message.
 *
 * Rendered on top of all other screen content when the game phase is PAUSED.
 */

import { motion } from 'framer-motion';
import { fadeIn, scaleIn } from '../../animations/variants';

export function PausedOverlay() {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
    >
      <motion.div
        variants={scaleIn}
        className="flex flex-col items-center gap-6"
      >
        {/* Animated pause icon */}
        <motion.div
          className="flex items-center gap-3"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <span className="block h-20 w-7 rounded-full bg-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.6)]" />
          <span className="block h-20 w-7 rounded-full bg-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.6)]" />
        </motion.div>

        {/* Title */}
        <motion.h2
          className="text-5xl font-bold text-amber-300"
          style={{ textShadow: '0 0 20px rgba(251,191,36,0.5)' }}
        >
          游戏暂停
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          className="text-2xl text-slate-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          等待主持人恢复...
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

export default PausedOverlay;
