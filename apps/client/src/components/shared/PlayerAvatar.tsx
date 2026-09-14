/**
 * PlayerAvatar — renders a player's name with their seat number badge.
 *
 * Used in player lists, the gem selection order display, and final
 * result rankings.  The avatar shows a circular seat-number badge
 * followed by the player's name.
 */

import { memo } from 'react';
import clsx from 'clsx';

export interface PlayerAvatarProps {
  /** The player's display name. */
  name: string;
  /** The seat number (1-based) assigned by the server. */
  seatNumber: number;
  /** Whether the player is currently connected. */
  isConnected?: boolean;
  /** Whether the player is ready (lobby). */
  isReady?: boolean;
  /** Whether this is the current player (highlights the avatar). */
  isCurrent?: boolean;
  /** Whether the player is the host. */
  isHost?: boolean;
  /** Additional CSS class names. */
  className?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
}

/** Size-specific Tailwind classes for the seat badge. */
const SIZE_BADGE: Record<NonNullable<PlayerAvatarProps['size']>, string> = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-12 h-12 text-lg',
};

const SIZE_TEXT: Record<NonNullable<PlayerAvatarProps['size']>, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

/** Background colors cycle through for visual seat differentiation. */
const SEAT_COLORS = [
  'bg-rose-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-pink-500',
];

function PlayerAvatarComponent({
  name,
  seatNumber,
  isConnected = true,
  isReady = false,
  isCurrent = false,
  isHost = false,
  className,
  size = 'md',
}: PlayerAvatarProps) {
  const seatColor = SEAT_COLORS[(seatNumber - 1) % SEAT_COLORS.length];

  return (
    <div
      className={clsx(
        'flex items-center gap-2',
        !isConnected && 'opacity-50',
        isCurrent && 'ring-2 ring-violet-400 rounded-lg px-1 py-0.5',
        className,
      )}
    >
      {/* Seat number badge */}
      <div
        className={clsx(
          'flex items-center justify-center rounded-full font-bold text-white shrink-0',
          SIZE_BADGE[size],
          seatColor,
        )}
      >
        {seatNumber}
      </div>

      {/* Player name */}
      <div className="flex flex-col min-w-0">
        <span
          className={clsx(
            'font-medium text-slate-100 truncate',
            SIZE_TEXT[size],
          )}
        >
          {name}
        </span>
        {isHost && (
          <span className="text-[10px] text-amber-400 leading-none">Host</span>
        )}
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-1 shrink-0">
        {isReady && (
          <span className="text-emerald-400 text-xs">Ready</span>
        )}
        {!isConnected && (
          <span className="text-slate-500 text-xs">Offline</span>
        )}
      </div>
    </div>
  );
}

export const PlayerAvatar = memo(PlayerAvatarComponent);
export default PlayerAvatar;
