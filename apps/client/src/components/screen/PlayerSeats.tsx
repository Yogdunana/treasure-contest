/**
 * PlayerSeats - Reusable component showing all player seats in a circular
 * or grid layout, optimized for the big screen.
 *
 * Shows each player's name, seat number, and connection status.  During
 * GEM_SELECTION, the current picker is highlighted with a golden border
 * and glow.  During NUMBER_SELECTION, each player's submission status
 * ("选择中..." or "已锁定") is shown.
 *
 * Layout mode:
 * - 'circle': Players arranged in a circle (default for 4-8 players)
 * - 'grid': Players in a responsive grid
 */

import { memo } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { slideIn, staggerContainer } from '../../animations/variants';
import type { PlayerSeat } from '@treasure-contest/shared';

/** Seat badge background colors cycle through for visual differentiation. */
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

export interface PlayerSeatsProps {
  /** Layout mode: circular or grid. */
  layout?: 'circle' | 'grid';
  /** Whether to show submission status during NUMBER_SELECTION. */
  showSubmissionStatus?: boolean;
  /** Whether to highlight the current picker during GEM_SELECTION. */
  highlightPicker?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

/** Renders a single player seat card. */
function SeatCard({
  seat,
  index,
  total,
  layout,
  showSubmissionStatus,
  highlightPicker,
}: {
  seat: PlayerSeat;
  index: number;
  total: number;
  layout: 'circle' | 'grid';
  showSubmissionStatus?: boolean;
  highlightPicker?: boolean;
}) {
  const currentPickerId = useGameStore((s) => s.currentPickerId);
  const phase = useGameStore((s) => s.phase);
  const revealedNumbers = useGameStore((s) => s.revealedNumbers);
  const collisionGroups = useGameStore((s) => s.collisionGroups);

  const seatBg = SEAT_BG[(seat.seatNumber - 1) % SEAT_BG.length];
  const isCurrentPicker =
    highlightPicker &&
    phase === 'GEM_SELECTION' &&
    currentPickerId === seat.playerId;

  const isVoided = collisionGroups.some(
    (g) => g.isVoided && g.playerIds.includes(seat.playerId),
  );

  // Check if this player has submitted (number revealed or in collision group)
  const hasRevealed =
    revealedNumbers[seat.playerId] !== undefined &&
    revealedNumbers[seat.playerId] !== null;
  const revealedNumber = revealedNumbers[seat.playerId];

  // Circular position calculation
  const angle = total > 0 ? (index / total) * 2 * Math.PI - Math.PI / 2 : 0;
  const radius = 280; // px from center
  const circleX = Math.cos(angle) * radius;
  const circleY = Math.sin(angle) * radius;

  const cardContent = (
    <motion.div
      variants={slideIn}
      layout
      className={clsx(
        'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-300',
        isCurrentPicker
          ? 'border-amber-400 bg-amber-950/40 shadow-[0_0_30px_rgba(251,191,36,0.5)]'
          : !seat.isConnected
            ? 'border-slate-700 bg-slate-900/40 opacity-60'
            : 'border-slate-600 bg-slate-800/60',
        isVoided && 'opacity-50',
      )}
    >
      {/* Seat number badge */}
      <div
        className={clsx(
          'flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg',
          seatBg,
          !seat.isConnected && 'opacity-50',
        )}
      >
        {seat.seatNumber}
      </div>

      {/* Player name */}
      <p className="max-w-[140px] truncate text-lg font-semibold text-slate-100">
        {seat.name}
      </p>

      {/* Connection status */}
      {!seat.isConnected ? (
        <span className="rounded-full bg-rose-900/50 px-3 py-0.5 text-xs text-rose-400">
          离线
        </span>
      ) : (
        <span className="rounded-full bg-emerald-900/40 px-3 py-0.5 text-xs text-emerald-400">
          在线
        </span>
      )}

      {/* Submission status during NUMBER_SELECTION */}
      {showSubmissionStatus && phase === 'NUMBER_SELECTION' && (
        <div className="mt-1">
          {seat.isReady ? (
            <span className="rounded-full bg-slate-700 px-3 py-0.5 text-xs text-slate-400">
              已提交
            </span>
          ) : (
            <motion.span
              className="rounded-full bg-violet-900/50 px-3 py-0.5 text-xs text-violet-300"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              选择中...
            </motion.span>
          )}
        </div>
      )}

      {/* Lock icon for submitted players during NUMBER_REVEAL */}
      {showSubmissionStatus &&
        (phase === 'NUMBER_REVEAL' || phase === 'ORDER_CALCULATION') &&
        hasRevealed && (
          <div className="mt-1 flex items-center gap-1 text-emerald-400">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span className="text-sm font-bold">
              {revealedNumber !== null && revealedNumber !== undefined
                ? revealedNumber
                : ''}
            </span>
          </div>
        )}

      {/* Current picker glow during GEM_SELECTION */}
      {isCurrentPicker && (
        <motion.div
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-amber-950"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          正在选宝石
        </motion.div>
      )}
    </motion.div>
  );

  if (layout === 'circle') {
    return (
      <motion.div
        className="absolute"
        style={{
          left: `calc(50% + ${circleX}px)`,
          top: `calc(50% + ${circleY}px)`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {cardContent}
      </motion.div>
    );
  }

  return cardContent;
}

function PlayerSeatsComponent({
  layout = 'circle',
  showSubmissionStatus = false,
  highlightPicker = false,
  className,
}: PlayerSeatsProps) {
  const playerSeats = useGameStore((s) => s.playerSeats);

  if (playerSeats.length === 0) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center text-slate-600',
          className,
        )}
      >
        <p className="text-xl">等待玩家加入...</p>
      </div>
    );
  }

  // Sort by seat number
  const sorted = [...playerSeats].sort((a, b) => a.seatNumber - b.seatNumber);

  if (layout === 'circle') {
    return (
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className={clsx('relative h-[640px] w-full', className)}
      >
        {sorted.map((seat, i) => (
          <SeatCard
            key={seat.playerId}
            seat={seat}
            index={i}
            total={sorted.length}
            layout="circle"
            showSubmissionStatus={showSubmissionStatus}
            highlightPicker={highlightPicker}
          />
        ))}
      </motion.div>
    );
  }

  // Grid layout
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={clsx(
        'grid gap-4',
        sorted.length <= 4
          ? 'grid-cols-2'
          : sorted.length <= 6
            ? 'grid-cols-3'
            : 'grid-cols-4',
        className,
      )}
    >
      {sorted.map((seat, i) => (
        <SeatCard
          key={seat.playerId}
          seat={seat}
          index={i}
          total={sorted.length}
          layout="grid"
          showSubmissionStatus={showSubmissionStatus}
          highlightPicker={highlightPicker}
        />
      ))}
    </motion.div>
  );
}

export const PlayerSeats = memo(PlayerSeatsComponent);
export default PlayerSeats;
