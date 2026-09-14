/**
 * CountdownRing — circular countdown timer rendered with SVG.
 *
 * Displays a ring that depletes as the remaining time decreases, with the
 * remaining seconds shown in the center.  When the timer reaches zero,
 * the optional `onExpire` callback is invoked once.
 *
 * Props:
 * - `seconds`: Current remaining seconds (counting down).
 * - `totalSeconds`: The full duration the timer started with (for ring ratio).
 * - `onExpire`: Called once when `seconds` hits 0.
 */

import { memo, useEffect, useRef } from 'react';
import clsx from 'clsx';

export interface CountdownRingProps {
  /** Remaining seconds. */
  seconds: number;
  /** Total seconds the timer started with (determines ring fill ratio). */
  totalSeconds: number;
  /** Called once when the timer reaches 0. */
  onExpire?: () => void;
  /** Pixel diameter of the ring. Defaults to 80. */
  size?: number;
  /** Stroke width of the ring. Defaults to 6. */
  strokeWidth?: number;
  /** Additional CSS class names. */
  className?: string;
}

function CountdownRingComponent({
  seconds,
  totalSeconds,
  onExpire,
  size = 80,
  strokeWidth = 6,
  className,
}: CountdownRingProps) {
  const hasExpired = useRef(false);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = totalSeconds > 0 ? Math.max(0, seconds / totalSeconds) : 0;
  const strokeDashoffset = circumference * (1 - ratio);

  // Color transitions: green → amber → red as time runs out
  const color =
    ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#eab308' : '#ef4444';

  useEffect(() => {
    if (seconds <= 0 && !hasExpired.current) {
      hasExpired.current = true;
      onExpire?.();
    }
    if (seconds > 0) {
      hasExpired.current = false;
    }
  }, [seconds, onExpire]);

  return (
    <div
      className={clsx('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease',
          }}
        />
      </svg>
      {/* Center text */}
      <span
        className="absolute inset-0 flex items-center justify-center font-bold tabular-nums"
        style={{
          fontSize: size * 0.28,
          color,
        }}
      >
        {Math.ceil(Math.max(0, seconds))}
      </span>
    </div>
  );
}

export const CountdownRing = memo(CountdownRingComponent);
export default CountdownRing;
