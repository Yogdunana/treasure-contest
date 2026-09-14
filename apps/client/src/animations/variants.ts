/**
 * Framer Motion animation variants.
 *
 * These reusable variant objects can be passed to the `variants` prop of
 * any `motion.*` component or used with `AnimatePresence` for enter/exit
 * transitions.
 */

import type { Variants, Transition } from 'framer-motion';

/**
 * Gem reveal animation — scales up from 0 with a slight bounce and a
 * rotation, simulating a gem materializing onto the board.
 *
 * Used when new gems appear during GEM_REVEAL.
 */
export const gemReveal: Variants = {
  hidden: {
    scale: 0,
    rotate: -180,
    opacity: 0,
  },
  visible: {
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
      mass: 0.8,
    },
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

/**
 * Number flip animation — rotates the card on the Y axis to reveal the
 * submitted number, like a game show card flip.
 *
 * Used during NUMBER_REVEAL when each player's submitted number is shown.
 */
export const numberFlip: Variants = {
  hidden: {
    rotateY: 180,
    opacity: 0,
  },
  visible: {
    rotateY: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 12,
    },
  },
  exit: {
    rotateY: -180,
    opacity: 0,
    transition: { duration: 0.3 },
  },
};

/**
 * Slide-in from the left — used for list items appearing sequentially
 * (e.g., selection order, queue list).
 */
export const slideIn: Variants = {
  hidden: {
    x: -100,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 14,
    },
  },
  exit: {
    x: 100,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

/**
 * Simple fade-in — used for overlays, banners, and general UI transitions
 * where a full slide is too aggressive.
 */
export const fadeIn: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

/**
 * Scale-in — grows from 0.8 to 1.0 with opacity.  Used for modal-like
 * elements, cards, and emphasis elements.
 */
export const scaleIn: Variants = {
  hidden: {
    scale: 0.8,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 150,
      damping: 18,
    },
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

/**
 * Champion effect — golden glow pulse for the winner's card during
 * RESULTS_REVEAL.  Combines a scale-up with a continuous glow animation.
 */
export const championEffect: Variants = {
  hidden: {
    scale: 0.5,
    opacity: 0,
    boxShadow: '0 0 0px rgba(255, 215, 0, 0)',
  },
  visible: {
    scale: 1,
    opacity: 1,
    boxShadow: [
      '0 0 20px rgba(255, 215, 0, 0.4)',
      '0 0 40px rgba(255, 215, 0, 0.8)',
      '0 0 20px rgba(255, 215, 0, 0.4)',
    ],
    transition: {
      scale: { type: 'spring', stiffness: 120, damping: 14 },
      opacity: { duration: 0.4 },
      boxShadow: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    transition: { duration: 0.3 },
  },
};

/**
 * Staggered container — delays children's animations so they appear
 * sequentially.  Use as the parent `motion.div` variants and pair with
 * any of the child variants above.
 */
export const staggerContainer: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

/**
 * Slide up — for elements entering from below (toasts, notifications).
 */
export const slideUp: Variants = {
  hidden: {
    y: 50,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 14,
    },
  },
  exit: {
    y: 50,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};
