/**
 * Common Framer Motion transition configurations.
 *
 * These pre-built `Transition` objects can be passed directly to the
 * `transition` prop of any `motion.*` component, or used inside custom
 * variant definitions.
 */

import type { Transition } from 'framer-motion';

/**
 * Default spring — a bouncy spring suitable for UI element entrances.
 * Stiffness 200, damping 18 produces a snappy but not jittery motion.
 */
export const spring: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 18,
  mass: 0.8,
};

/**
 * Soft spring — gentler, more organic motion for larger elements.
 * Lower stiffness with higher damping for a smooth feel.
 */
export const softSpring: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 14,
  mass: 1,
};

/**
 * Snappy spring — very quick and tight for small interactive elements
 * like buttons and badges.
 */
export const snappySpring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
  mass: 0.5,
};

/**
 * Tween — fast linear-ish fade for quick transitions (200ms).
 * Uses ease-out for a natural deceleration.
 */
export const tweenFast: Transition = {
  duration: 0.2,
  ease: 'easeOut',
};

/**
 * Tween — medium duration for standard UI transitions (300ms).
 * Uses ease-out.
 */
export const tweenMedium: Transition = {
  duration: 0.3,
  ease: 'easeOut',
};

/**
 * Tween — slow duration for dramatic reveals (500ms).
 * Uses ease-in-out for a smooth bidirectional feel.
 */
export const tweenSlow: Transition = {
  duration: 0.5,
  ease: 'easeInOut',
};

/**
 * Tween — very slow for hero / champion reveals (800ms).
 * Uses ease-out for a building anticipation feel.
 */
export const tweenDramatic: Transition = {
  duration: 0.8,
  ease: 'easeOut',
};

/**
 * Stagger transition — for sequencing child element entrances.
 * Children animate 80ms apart with a 100ms initial delay.
 */
export const staggerTransition: Transition = {
  staggerChildren: 0.08,
  delayChildren: 0.1,
};

/**
 * Gem reveal transition — spring with a slight overshoot for a
 * "materializing" effect.
 */
export const gemRevealTransition: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 15,
  mass: 0.8,
};

/**
 * Number flip transition — spring with moderate stiffness for the
 * card flip reveal.
 */
export const numberFlipTransition: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 12,
  mass: 1,
};

/**
 * Champion effect transition — combines a spring scale-in with a
 * continuous golden glow pulse loop.
 */
export const championTransition: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 14,
};
