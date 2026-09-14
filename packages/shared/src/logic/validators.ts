import type { Player, Gem } from '../types/game.js';
import type { GamePhase } from '../types/phases.js';

/**
 * Validate a player's number submission.
 *
 * Checks that the submitted number is in the player's availableNumbers
 * (i.e. has not been used in a previous round and is a valid number 1-7).
 *
 * @param player - The player submitting the number.
 * @param number - The number the player wants to submit.
 * @returns Validation result with valid flag and optional error message.
 */
export function validateNumberSubmission(
  player: Player,
  number: number,
): { valid: boolean; error?: string } {
  if (!player.availableNumbers.includes(number)) {
    return {
      valid: false,
      error: `Number ${number} is not available. Available: [${player.availableNumbers.join(', ')}]`,
    };
  }
  return { valid: true };
}

/**
 * Validate a player's gem selection.
 *
 * Checks:
 * 1. It is the player's turn (player.id matches currentPickerId).
 * 2. The gem exists in the current round's gems.
 * 3. The gem has not already been picked.
 *
 * @param player - The player attempting to pick.
 * @param gemId - The ID of the gem being selected.
 * @param currentGems - The gems available in the current round.
 * @param currentPickerId - The ID of the player whose turn it currently is.
 * @returns Validation result with valid flag and optional error message.
 */
export function validateGemSelection(
  player: Player,
  gemId: string,
  currentGems: Gem[],
  currentPickerId: string,
): { valid: boolean; error?: string } {
  // 1. Check it is the player's turn
  if (player.id !== currentPickerId) {
    return {
      valid: false,
      error: `It is not your turn. Current picker: ${currentPickerId}`,
    };
  }

  // 2. Check the gem exists in the current round
  const gem = currentGems.find((g) => g.id === gemId);
  if (!gem) {
    return {
      valid: false,
      error: `Gem ${gemId} does not exist in the current round`,
    };
  }

  // 3. Check the gem has not been picked
  if (gem.pickedBy !== undefined) {
    return {
      valid: false,
      error: `Gem ${gemId} has already been picked by ${gem.pickedBy}`,
    };
  }

  return { valid: true };
}

/**
 * Validate that the game is in the expected phase.
 *
 * @param currentPhase - The current game phase.
 * @param expectedPhase - The expected game phase.
 * @returns true if the phases match, false otherwise.
 */
export function validatePhase(
  currentPhase: GamePhase,
  expectedPhase: GamePhase,
): boolean {
  return currentPhase === expectedPhase;
}
