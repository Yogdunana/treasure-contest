import type { CollisionGroup } from '../types/game.js';
import { COLLISION_VOID_THRESHOLD } from '../constants.js';

/**
 * A single player's number submission for a round, enriched with seat number
 * for tie-breaking purposes.
 */
export interface NumberSubmission {
  playerId: string;
  seatNumber: number;
  /** The number submitted this round, or null if the player did not submit. */
  number: number | null;
}

/**
 * Result of the order calculation.
 */
export interface OrderResult {
  /** PlayerIds in the order they will pick gems (highest number first). */
  order: string[];
  /** All collision groups (2+ players who submitted the same number). */
  collisionGroups: CollisionGroup[];
  /** Numbers voided due to 4+ player collisions. */
  voidedNumbers: number[];
}

/**
 * Calculate the gem selection order based on submitted numbers.
 *
 * Rules:
 * - Players are sorted by submitted number descending.
 * - 2-3 players with the same number: resolved by seat order (clockwise,
 *   starting from the lowest seat number). A CollisionGroup with
 *   isVoided = false is recorded.
 * - 4+ players with the same number: that number is voided. All players in
 *   the group lose their selection eligibility for this round. A
 *   CollisionGroup with isVoided = true is recorded.
 * - Players who did not submit (null) do not participate in ordering.
 *
 * @param submissions - Array of player submissions with seat numbers.
 * @returns The selection order, collision groups, and voided numbers.
 */
export function calculateOrder(submissions: NumberSubmission[]): OrderResult {
  // 1. Filter out players who did not submit (null)
  const active = submissions.filter((s) => s.number !== null);

  // 2. Group remaining players by submitted number
  const groupsByNumber = new Map<number, NumberSubmission[]>();
  for (const sub of active) {
    const num = sub.number as number;
    if (!groupsByNumber.has(num)) {
      groupsByNumber.set(num, []);
    }
    groupsByNumber.get(num)!.push(sub);
  }

  const collisionGroups: CollisionGroup[] = [];
  const voidedNumbers: number[] = [];
  // Groups that will be included in the final order (non-voided)
  const orderGroups: { number: number; playerIds: string[] }[] = [];

  for (const [number, group] of groupsByNumber) {
    if (group.length >= COLLISION_VOID_THRESHOLD) {
      // 4+ players: the number is voided, players lose eligibility
      voidedNumbers.push(number);
      collisionGroups.push({
        number,
        playerIds: group.map((g) => g.playerId),
        isVoided: true,
      });
    } else if (group.length >= 2) {
      // 2-3 players: resolved by seat order (clockwise, lowest seat first)
      const sortedBySeat = [...group].sort((a, b) => a.seatNumber - b.seatNumber);
      collisionGroups.push({
        number,
        playerIds: sortedBySeat.map((g) => g.playerId),
        isVoided: false,
      });
      orderGroups.push({
        number,
        playerIds: sortedBySeat.map((g) => g.playerId),
      });
    } else {
      // Single player: no collision, directly added to the order
      orderGroups.push({
        number,
        playerIds: group.map((g) => g.playerId),
      });
    }
  }

  // 3. Sort order groups by their number descending (highest number picks first)
  orderGroups.sort((a, b) => b.number - a.number);

  // 4. Build the final flattened order
  const order: string[] = [];
  for (const group of orderGroups) {
    order.push(...group.playerIds);
  }

  // 5. Sort collision groups by number descending for consistent output
  collisionGroups.sort((a, b) => b.number - a.number);

  // 6. Sort voided numbers descending
  voidedNumbers.sort((a, b) => b - a);

  return { order, collisionGroups, voidedNumbers };
}
