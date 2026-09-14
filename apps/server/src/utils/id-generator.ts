import { v4 as uuidv4 } from 'uuid';

/**
 * Characters used for room-code generation.
 *
 * Excludes visually ambiguous characters to reduce player entry errors:
 *   - No `0` (zero) or `O` (oh)
 *   - No `1` (one) or `I` (eye)
 *
 * Remaining alphabet: 2-9 (minus 1) + A-Z (minus O, I) = 8 digits + 24 letters.
 */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Length of a generated room code. */
const ROOM_CODE_LENGTH = 6;

/**
 * Generate a human-friendly 6-character room code.
 *
 * The code uses an unambiguous alphabet (no 0/O, 1/I) and is uppercased.
 * Collisions are statistically negligible given the small number of active
 * rooms at any one time, but the caller should still verify uniqueness.
 *
 * @example `"K7R3MP"`, `"Z9QBXN"`
 */
export function generateRoomCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    chars.push(ROOM_CODE_ALPHABET[idx]);
  }
  return chars.join('');
}

/**
 * Generate a unique player ID (UUID v4).
 *
 * Player IDs are stored as the primary key in the `players` table and are
 * used in auth tokens, socket rooms, and game history.
 */
export function generatePlayerId(): string {
  return uuidv4();
}

/**
 * Generate a unique queue entry ID (UUID v4).
 *
 * Used as the primary key for the `waiting_queue` table so that a single
 * player can be queued only once per room.
 */
export function generateQueueEntryId(): string {
  return uuidv4();
}
