/**
 * usePlayerActions — React hook for player game actions.
 *
 * Wraps the typed socket client to emit the two player-facing events:
 * - `action:submit_number` — submit a number (1-7) during NUMBER_SELECTION
 * - `action:select_gem`   — pick a gem during GEM_SELECTION
 *
 * The hook also guards against emitting when the socket is not connected
 * or when it is not the player's turn.
 */

import { useCallback, useRef } from 'react';
import { socket } from '../lib/socket-client';
import { useSocketStore } from '../store/socket-store';
import { useGameStore } from '../store/game-store';

export interface UsePlayerActionsReturn {
  /**
   * Submit a number for the current round.
   * @param number — The number to submit (must be from availableNumbers).
   * @returns `true` if the event was emitted, `false` if it was blocked
   *          (socket disconnected, already submitted, or number not available).
   */
  submitNumber: (number: number) => boolean;
  /**
   * Select (pick) a gem during GEM_SELECTION.
   * @param gemId — The ID of the gem to pick (format: `gem_r{round}_{index}`).
   * @returns `true` if the event was emitted, `false` if it was blocked
   *          (socket disconnected or not the player's turn).
   */
  selectGem: (gemId: string) => boolean;
}

export function usePlayerActions(): UsePlayerActionsReturn {
  const isConnected = useSocketStore((s) => s.isConnected);
  const pendingNumberRef = useRef(false);
  const pendingGemRef = useRef(false);

  const submitNumber = useCallback(
    (number: number): boolean => {
      if (!isConnected) return false;

      const state = useGameStore.getState();
      if (state.roundSubmission !== null) return false;
      if (pendingNumberRef.current) return false;
      if (!state.availableNumbers.includes(number)) return false;
      if (state.phase !== 'NUMBER_SELECTION') return false;

      pendingNumberRef.current = true;
      socket.emit('action:submit_number', { number });
      window.setTimeout(() => {
        pendingNumberRef.current = false;
      }, 800);
      return true;
    },
    [isConnected],
  );

  const selectGem = useCallback(
    (gemId: string): boolean => {
      if (!isConnected) return false;

      const state = useGameStore.getState();
      if (state.phase !== 'GEM_SELECTION') return false;
      if (state.currentPickerId !== state.playerId) return false;
      if (pendingGemRef.current) return false;

      pendingGemRef.current = true;
      socket.emit('action:select_gem', { gemId });
      window.setTimeout(() => {
        pendingGemRef.current = false;
      }, 800);
      return true;
    },
    [isConnected],
  );

  return { submitNumber, selectGem };
}

export default usePlayerActions;
