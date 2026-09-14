/**
 * GemIcon — renders a colored gem icon based on GemColor.
 *
 * The gem is drawn with CSS using a diamond clip-path and a color-specific
 * gradient + glow.  An emoji fallback is available via the `variant` prop
 * for contexts where a simpler representation is preferred.
 */

import { memo } from 'react';
import clsx from 'clsx';
import type { GemColor } from '@treasure-contest/shared';
import { GEM_COLOR_EMOJI } from '@treasure-contest/shared';

export type GemIconVariant = 'diamond' | 'emoji';

export interface GemIconProps {
  /** The gem color to render. */
  color: GemColor;
  /** Visual style: `diamond` (CSS shape) or `emoji` (text emoji). */
  variant?: GemIconVariant;
  /** Pixel size of the icon. Defaults to 48 (3rem). */
  size?: number;
  /** Optional value badge to display in the center of the gem. */
  value?: number;
  /** Whether the gem has been picked (dims the icon). */
  picked?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

/** Tailwind color classes for each gem color. */
const COLOR_TEXT_CLASS: Record<GemColor, string> = {
  red: 'text-gem-red',
  blue: 'text-gem-blue',
  green: 'text-gem-green',
  yellow: 'text-gem-yellow',
  purple: 'text-gem-purple',
};

function GemIconComponent({
  color,
  variant = 'diamond',
  size = 48,
  value,
  picked = false,
  className,
}: GemIconProps) {
  if (variant === 'emoji') {
    return (
      <span
        className={clsx(
          'inline-flex items-center justify-center no-select',
          picked && 'opacity-40 grayscale',
          className,
        )}
        style={{ fontSize: size, lineHeight: 1 }}
        role="img"
        aria-label={`${color} gem`}
      >
        {GEM_COLOR_EMOJI[color]}
      </span>
    );
  }

  // Diamond variant — CSS clip-path shape with gradient + glow
  return (
    <span
      className={clsx(
        'gem-diamond relative inline-flex items-center justify-center no-select',
        `gem-${color}`,
        picked && 'opacity-40',
        className,
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${color} gem${value !== undefined ? ` worth ${value}` : ''}`}
    >
      {value !== undefined && (
        <span
          className={clsx(
            'absolute inset-0 flex items-center justify-center font-bold text-white',
            COLOR_TEXT_CLASS[color],
          )}
          style={{
            fontSize: size * 0.35,
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            zIndex: 1,
          }}
        >
          {value}
        </span>
      )}
    </span>
  );
}

export const GemIcon = memo(GemIconComponent);
export default GemIcon;
