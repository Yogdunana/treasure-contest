/**
 * useGamePhase — React hook for reading the current game phase and
 * phase-specific data.
 *
 * Provides convenience accessors for the most commonly used state slices
 * from the game store, plus a helper to determine whether it is the
 * current player's turn during GEM_SELECTION.
 *
 * @returns An object with the current phase, round, and derived booleans.
 */

import { useMemo } from 'react';
import { useGameStore } from '../store/game-store';
import type { GamePhase } from '@treasure-contest/shared';

export interface UseGamePhaseReturn {
  /** The current game phase (LOBBY, NUMBER_SELECTION, GEM_SELECTION, etc.) */
  phase: GamePhase;
  /** The current round number (1-6, or 0 before game starts). */
  currentRound: number;
  /** True if the game is in the lobby (pre-start). */
  isLobby: boolean;
  /** True if the game is in number selection phase. */
  isNumberSelection: boolean;
  /** True if the game is in gem selection phase. */
  isGemSelection: boolean;
  /** True if the game is in the results reveal phase. */
  isResultsReveal: boolean;
  /** True if the game is over. */
  isGameOver: boolean;
  /** True if the game is paused. */
  isPaused: boolean;
  /** The ID of the player who is currently picking a gem (GEM_SELECTION). */
  currentPickerId: string | null;
  /** The current player's own ID (if they are a player). */
  myPlayerId: string | null;
  /**
   * True if it is the current player's turn to pick a gem.
   * Only valid during GEM_SELECTION; returns false in all other phases
   * or when the player is not the current picker.
   */
  isMyTurn: boolean;
  /** Whether the player has already submitted a number this round. */
  hasSubmitted: boolean;
}

export function useGamePhase(): UseGamePhaseReturn {
  const phase = useGameStore((s) => s.phase);
  const currentRound = useGameStore((s) => s.currentRound);
  const currentPickerId = useGameStore((s) => s.currentPickerId);
  const playerId = useGameStore((s) => s.playerId);
  const roundSubmission = useGameStore((s) => s.roundSubmission);
  const isPaused = phase === 'PAUSED';

  return useMemo(
    () => ({
      phase,
      currentRound,
      isLobby: phase === 'LOBBY',
      isNumberSelection: phase === 'NUMBER_SELECTION',
      isGemSelection: phase === 'GEM_SELECTION',
      isResultsReveal: phase === 'RESULTS_REVEAL',
      isGameOver: phase === 'GAME_OVER',
      isPaused,
      currentPickerId,
      myPlayerId: playerId,
      isMyTurn:
        phase === 'GEM_SELECTION' &&
        currentPickerId !== null &&
        currentPickerId === playerId,
      hasSubmitted: roundSubmission !== null,
    }),
    [phase, currentRound, currentPickerId, playerId, roundSubmission, isPaused],
  );
}

export default useGamePhase;
