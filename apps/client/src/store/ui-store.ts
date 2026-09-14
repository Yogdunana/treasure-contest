/**
 * UI store — manages client-side-only UI state that is not derived from
 * the server snapshot.
 *
 * This includes animation phase tracking, pause overlay state, and the
 * disconnected banner visibility.  Components subscribe to this store to
 * show / hide transient UI elements without affecting the game state.
 */

import { create } from 'zustand';
import type { GamePhase } from '@treasure-contest/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Tracks the current animation transition between game phases.
 * - `idle`: No active transition animation.
 * - `entering`: A new phase is animating in.
 * - `exiting`: The current phase is animating out.
 */
export type AnimationPhase = 'idle' | 'entering' | 'exiting';

export interface UIStore {
  /** Current animation transition state. */
  animationPhase: AnimationPhase;
  /** The phase that is currently being animated (for transition matching). */
  animatingPhase: GamePhase | null;
  /** Whether the game is locally paused (mirror of server pause state). */
  isPaused: boolean;
  /** Whether to show the "connection lost" banner. */
  showDisconnectedBanner: boolean;

  // Actions
  setAnimationPhase: (phase: AnimationPhase) => void;
  setAnimatingPhase: (phase: GamePhase | null) => void;
  setIsPaused: (paused: boolean) => void;
  setShowDisconnectedBanner: (show: boolean) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

const initialState = {
  animationPhase: 'idle' as AnimationPhase,
  animatingPhase: null as GamePhase | null,
  isPaused: false,
  showDisconnectedBanner: false,
};

export const useUIStore = create<UIStore>((set) => ({
  ...initialState,

  setAnimationPhase: (animationPhase) => set({ animationPhase }),
  setAnimatingPhase: (animatingPhase) => set({ animatingPhase }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setShowDisconnectedBanner: (showDisconnectedBanner) =>
    set({ showDisconnectedBanner }),

  reset: () => set({ ...initialState }),
}));

export default useUIStore;
