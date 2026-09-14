/**
 * GemSelection - GEM_SELECTION phase display for the big screen.
 *
 * Shows remaining gems in the center.  The current picker is highlighted
 * with a golden border and glow, with a 5-second countdown ring.  When
 * a gem is picked, it flies from center to the picker's area (using
 * layoutId for shared element animation).  The picker area shows their
 * collected gems.  "轮到 [玩家名] 选宝石" text is shown, and the
 * selection order is displayed at the bottom with completed pickers
 * dimmed.
 */

import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { GemIcon } from '../shared/GemIcon';
import { CountdownRing } from '../shared/CountdownRing';
import {
  TIMING_CONFIG,
  GEM_COLOR_LABELS,
  type Gem,
  type PlayerSeat,
} from '@treasure-contest/shared';
import {
  gemReveal,
  staggerContainer,
  fadeIn,
  scaleIn,
  slideIn,
} from '../../animations/variants';

/** Seat badge background colors. */
const SEAT_BG = [
  'bg-rose-600',
  'bg-sky-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-violet-600',
  'bg-cyan-600',
  'bg-orange-600',
  'bg-pink-600',
];

export function GemSelection() {
  const gems = useGameStore((s) => s.gems);
  const timer = useGameStore((s) => s.timer);
  const currentPickerId = useGameStore((s) => s.currentPickerId);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const selectionOrder = useGameStore((s) => s.selectionOrder);

  // Map player IDs to seats
  const seatMap = new Map<string, PlayerSeat>();
  for (const seat of playerSeats) {
    seatMap.set(seat.playerId, seat);
  }

  const currentPicker = currentPickerId
    ? seatMap.get(currentPickerId)
    : undefined;

  const totalSeconds = TIMING_CONFIG.GEM_PICK_SECONDS_PER_PLAYER;
  const remainingSeconds = timer
    ? Math.ceil(timer.remaining / 1000)
    : totalSeconds;

  // Split gems into remaining and picked
  const remainingGems = gems.filter((g) => g.pickedBy === undefined);
  const pickedGems = gems.filter((g) => g.pickedBy !== undefined);

  // Find the current picker's index in the selection order
  const currentPickerIndex = currentPickerId
    ? selectionOrder.indexOf(currentPickerId)
    : -1;

  // Group picked gems by picker
  const gemsByPicker = new Map<string, Gem[]>();
  for (const gem of pickedGems) {
    if (gem.pickedBy) {
      const list = gemsByPicker.get(gem.pickedBy) ?? [];
      list.push(gem);
      gemsByPicker.set(gem.pickedBy, list);
    }
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex h-full w-full flex-col"
    >
      {/* Top: Current picker announcement */}
      <motion.div variants={fadeIn} className="flex justify-center pt-4">
        {currentPicker ? (
          <motion.div
            className="flex items-center gap-4 rounded-2xl border-2 border-amber-400/60 bg-amber-950/30 px-8 py-4"
            animate={{
              boxShadow: [
                '0 0 20px rgba(251,191,36,0.3)',
                '0 0 40px rgba(251,191,36,0.6)',
                '0 0 20px rgba(251,191,36,0.3)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <span className="text-3xl text-amber-400">👑</span>
            <span className="text-3xl font-bold text-amber-200">
              轮到 {currentPicker.name} 选宝石
            </span>
          </motion.div>
        ) : (
          <p className="text-2xl text-slate-400">准备选宝石...</p>
        )}
      </motion.div>

      {/* Main content: gems + picker */}
      <div className="flex flex-1 items-center justify-center gap-8">
        {/* Center: remaining gems + countdown */}
        <motion.div
          variants={scaleIn}
          className="flex flex-col items-center gap-6"
        >
          {/* Countdown ring */}
          {currentPicker && (
            <CountdownRing
              seconds={remainingSeconds}
              totalSeconds={totalSeconds}
              size={120}
              strokeWidth={8}
            />
          )}

          {/* Remaining gems */}
          <div className="flex items-center justify-center gap-6">
            <AnimatePresence mode="popLayout">
              {remainingGems.map((gem) => (
                <motion.div
                  key={gem.id}
                  layoutId={`gem-${gem.id}`}
                  className={`gem-${gem.color} relative flex flex-col items-center gap-2`}
                  initial={{ scale: 0, rotate: -180, opacity: 0 }}
                  animate={{
                    scale: 1,
                    rotate: 0,
                    opacity: 1,
                    boxShadow: [
                      `0 0 20px var(--gem-glow)`,
                      `0 0 40px var(--gem-glow)`,
                      `0 0 20px var(--gem-glow)`,
                    ],
                  }}
                  exit={{
                    scale: 0,
                    opacity: 0,
                    transition: { duration: 0.3 },
                  }}
                  transition={{
                    scale: { type: 'spring', stiffness: 200, damping: 15 },
                    rotate: { type: 'spring', stiffness: 200, damping: 15 },
                    boxShadow: {
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  }}
                >
                  <div
                    className="rounded-3xl p-4"
                    style={{ background: 'rgba(15,23,42,0.6)' }}
                  >
                    <GemIcon color={gem.color} size={100} value={gem.value} />
                  </div>
                  <div className="text-center">
                    <p className="text-base text-slate-300">
                      {GEM_COLOR_LABELS[gem.color]}
                    </p>
                    <p className="text-2xl font-bold text-amber-400">
                      {gem.value}分
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {remainingGems.length === 0 && (
              <motion.p
                variants={fadeIn}
                className="text-2xl text-slate-500"
              >
                所有宝石已被选走
              </motion.p>
            )}
          </div>
        </motion.div>

        {/* Right: Current picker's collected gems */}
        {currentPicker && (
          <motion.div
            variants={slideIn}
            className="flex flex-col items-center gap-4"
          >
            <div
              className={clsx(
                'flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white',
                SEAT_BG[(currentPicker.seatNumber - 1) % SEAT_BG.length],
              )}
            >
              {currentPicker.seatNumber}
            </div>
            <p className="text-xl font-bold text-amber-200">
              {currentPicker.name}
            </p>

            {/* Collected gems */}
            <div className="flex min-h-[120px] min-w-[120px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-amber-500/40 bg-amber-950/20 p-4">
              <AnimatePresence>
                {(gemsByPicker.get(currentPickerId!) ?? []).map((gem) => (
                  <motion.div
                    key={gem.id}
                    layoutId={`gem-${gem.id}`}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 0.8, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 200,
                      damping: 18,
                    }}
                  >
                    <GemIcon color={gem.color} size={48} value={gem.value} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {(gemsByPicker.get(currentPickerId!) ?? []).length === 0 && (
                <span className="text-sm text-slate-600">尚未获得宝石</span>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom: Selection order progress */}
      <motion.div
        variants={fadeIn}
        className="flex justify-center gap-2 pb-4 pt-4"
      >
        {selectionOrder.map((playerId, index) => {
          const seat = seatMap.get(playerId);
          if (!seat) return null;

          const isCurrent = playerId === currentPickerId;
          const isCompleted =
            (gemsByPicker.get(playerId)?.length ?? 0) > 0 ||
            index < currentPickerIndex;

          return (
            <motion.div
              key={playerId}
              layout
              className={clsx(
                'flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all',
                isCurrent
                  ? 'border-amber-400 bg-amber-950/30'
                  : isCompleted
                    ? 'border-slate-700 bg-slate-900/40 opacity-50'
                    : 'border-slate-600 bg-slate-800/40',
              )}
            >
              {/* Order number */}
              <span
                className={clsx(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  isCurrent
                    ? 'bg-amber-400 text-amber-950'
                    : isCompleted
                      ? 'bg-slate-700 text-slate-500'
                      : 'bg-slate-600 text-slate-300',
                )}
              >
                {index + 1}
              </span>

              {/* Seat badge */}
              <span
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white',
                  SEAT_BG[(seat.seatNumber - 1) % SEAT_BG.length],
                )}
              >
                {seat.seatNumber}
              </span>

              {/* Name */}
              <span className="max-w-[80px] truncate text-sm text-slate-300">
                {seat.name}
              </span>

              {/* Completed check */}
              {isCompleted && !isCurrent && (
                <svg
                  className="h-4 w-4 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

export default GemSelection;
