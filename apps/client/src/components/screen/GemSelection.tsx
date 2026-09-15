/**
 * GemSelection - GEM_SELECTION phase display for the big screen.
 *
 * Layout for 1080p projector:
 * - Compact header: whose turn + countdown (no duplicate identity card)
 * - Center stage: remaining gems large and spaced
 * - Bottom rail: pick order, with the taken gem shown on each chip
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
  staggerContainer,
  fadeIn,
  scaleIn,
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

  const remainingGems = gems.filter((g) => g.pickedBy === undefined);
  const pickedGems = gems.filter((g) => g.pickedBy !== undefined);

  const currentPickerIndex = currentPickerId
    ? selectionOrder.indexOf(currentPickerId)
    : -1;

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
      className="flex h-full min-h-0 w-full flex-col px-6"
    >
      {/* Compact turn header */}
      <motion.div variants={fadeIn} className="flex shrink-0 justify-center pt-2">
        {currentPicker ? (
          <div className="flex items-center gap-6 rounded-2xl border border-amber-400/40 bg-slate-900/60 px-6 py-2.5">
            <div className="flex items-center gap-3">
              <span
                className={clsx(
                  'flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white',
                  SEAT_BG[(currentPicker.seatNumber - 1) % SEAT_BG.length],
                )}
              >
                {currentPicker.seatNumber}
              </span>
              <div>
                <p className="text-sm text-amber-300/80">当前选择</p>
                <p className="text-2xl font-bold leading-tight text-amber-100">
                  轮到 {currentPicker.name} 选宝石
                </p>
              </div>
            </div>

            <div className="h-10 w-px bg-amber-400/25" />

            <CountdownRing
              seconds={remainingSeconds}
              totalSeconds={totalSeconds}
              size={72}
              strokeWidth={6}
            />

            <div className="h-10 w-px bg-amber-400/25" />

            <p className="text-lg text-slate-400">
              剩余{' '}
              <span className="text-2xl font-bold tabular-nums text-slate-100">
                {remainingGems.length}
              </span>{' '}
              颗
            </p>
          </div>
        ) : (
          <p className="text-2xl text-slate-400">准备选宝石...</p>
        )}
      </motion.div>

      {/* Remaining gems — large, centered, generous spacing */}
      <motion.div
        variants={scaleIn}
        className="flex min-h-0 flex-1 items-center justify-center"
      >
        <div className="flex items-center justify-center gap-10">
          <AnimatePresence mode="popLayout">
            {remainingGems.map((gem) => (
              <motion.div
                key={gem.id}
                layoutId={`gem-${gem.id}`}
                className={`gem-${gem.color} flex flex-col items-center gap-3`}
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{
                  scale: 1,
                  rotate: 0,
                  opacity: 1,
                }}
                exit={{
                  scale: 0.4,
                  opacity: 0,
                  transition: { duration: 0.25 },
                }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 16,
                }}
              >
                <motion.div
                  className="rounded-[2rem] p-6"
                  style={{ background: 'rgba(15,23,42,0.55)' }}
                  animate={{
                    boxShadow: [
                      `0 0 24px var(--gem-glow)`,
                      `0 0 48px var(--gem-glow)`,
                      `0 0 24px var(--gem-glow)`,
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <GemIcon color={gem.color} size={132} value={gem.value} />
                </motion.div>
                <div className="text-center">
                  <p className="text-xl font-semibold text-slate-200">
                    {GEM_COLOR_LABELS[gem.color]}
                  </p>
                  <p className="text-3xl font-bold text-amber-400">
                    {gem.value}
                    <span className="ml-1 text-lg font-medium text-slate-500">分</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {remainingGems.length === 0 && (
            <motion.p variants={fadeIn} className="text-2xl text-slate-500">
              所有宝石已被选走
            </motion.p>
          )}
        </div>
      </motion.div>

      {/* Pick-order timeline */}
      <motion.div
        variants={fadeIn}
        className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-3 px-40 pb-5 pt-2"
      >
        {selectionOrder.map((playerId, index) => {
          const seat = seatMap.get(playerId);
          if (!seat) return null;

          const taken = gemsByPicker.get(playerId) ?? [];
          const isCurrent = playerId === currentPickerId;
          const isCompleted = taken.length > 0 || index < currentPickerIndex;

          return (
            <div key={playerId} className="flex items-center gap-3">
              {index > 0 && (
                <span
                  className={clsx(
                    'hidden text-lg sm:inline',
                    isCompleted || isCurrent ? 'text-amber-500/50' : 'text-slate-700',
                  )}
                >
                  →
                </span>
              )}
              <motion.div
                layout
                className={clsx(
                  'flex min-w-[9.5rem] items-center gap-2.5 rounded-xl border px-3 py-2.5',
                  isCurrent
                    ? 'border-amber-400 bg-amber-950/40 shadow-[0_0_18px_rgba(251,191,36,0.35)]'
                    : isCompleted
                      ? 'border-slate-700 bg-slate-900/50'
                      : 'border-slate-600/80 bg-slate-800/40',
                )}
              >
                <span
                  className={clsx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    isCurrent
                      ? 'bg-amber-400 text-amber-950'
                      : isCompleted
                        ? 'bg-slate-700 text-slate-400'
                        : 'bg-slate-600 text-slate-200',
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={clsx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
                    SEAT_BG[(seat.seatNumber - 1) % SEAT_BG.length],
                    isCompleted && !isCurrent && 'opacity-70',
                  )}
                >
                  {seat.seatNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      'max-w-[7rem] truncate text-sm font-semibold',
                      isCurrent ? 'text-amber-100' : 'text-slate-200',
                    )}
                  >
                    {seat.name}
                  </p>
                  {isCurrent && (
                    <p className="text-[11px] text-amber-300">选择中</p>
                  )}
                </div>
                {taken.length > 0 ? (
                  <div className="flex items-center gap-1">
                    {taken.map((gem) => (
                      <motion.div
                        key={gem.id}
                        layoutId={`gem-${gem.id}`}
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                      >
                        <GemIcon color={gem.color} size={28} value={gem.value} />
                      </motion.div>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

export default GemSelection;
