/**
 * QueueIndicator - Small widget shown in the corner of the big screen.
 *
 * Displays "等待中: N 人" when the waiting queue has people, and is
 * hidden entirely when the queue is empty.  Features a subtle pulsing
 * animation to draw attention without being distracting.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';

export function QueueIndicator() {
  const queueCount = useGameStore((s) => s.queueCount);

  return (
    <AnimatePresence>
      {queueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: 50 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8, x: 50 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          className="absolute right-6 top-6 z-30"
        >
          <motion.div
            className="flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-950/60 px-4 py-2 backdrop-blur-sm"
            animate={{
              boxShadow: [
                '0 0 0px rgba(56,189,248,0)',
                '0 0 15px rgba(56,189,248,0.3)',
                '0 0 0px rgba(56,189,248,0)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {/* Pulsing dot */}
            <motion.span
              className="block h-2.5 w-2.5 rounded-full bg-sky-400"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <span className="text-lg font-semibold text-sky-300">
              等待中: {queueCount} 人
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default QueueIndicator;
