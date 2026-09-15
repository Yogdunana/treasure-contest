import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

/**
 * Auth-token generation and verification.
 *
 * Token format:  `{playerId}:{roomCode}:{gameSession}:{random}`
 *
 * - `playerId`    — identifies the player row.
 * - `roomCode`     — scopes the token to a single room.
 * - `gameSession`  — a per-room counter that increments on every restart;
 *                    including it in the token means tokens from a previous
 *                    game of the same room are automatically rejected
 *                    (cross-game isolation).
 * - `random`       — a UUID that makes the token unguessable.
 *
 * The token is stored in the `players.auth_token` column and sent to the
 * client (stored in localStorage for Layer-1 reconnect).  On reconnect the
 * client sends the token back; the server verifies that the session matches
 * the room's current `game_session`.
 */

/** Delimiter used inside the token string. Must not appear in room codes. */
const TOKEN_DELIMITER = ':';

/**
 * Generate a new auth token for a player.
 *
 * @param playerId   The player's UUID.
 * @param roomCode   The room code the player is in.
 * @param gameSession The room's current game session number.
 * @returns The token string.
 */
export function generateAuthToken(
  playerId: string,
  roomCode: string,
  gameSession: number,
): string {
  const random = uuidv4().replace(/-/g, '');
  return [playerId, roomCode, gameSession, random].join(TOKEN_DELIMITER);
}

/** Result of {@link verifyAuthToken}. */
export interface AuthTokenVerification {
  valid: boolean;
  playerId?: string;
  roomCode?: string;
  session?: number;
}

/**
 * Verify that an auth token is well-formed and that its embedded game
 * session matches the expected session.
 *
 * @param token           The token sent by the client.
 * @param expectedSession The room's current game session number.
 * @returns Verification result with extracted fields.
 */
export function verifyAuthToken(
  token: string,
  expectedSession: number,
): AuthTokenVerification {
  if (!token) {
    return { valid: false };
  }

  const parts = token.split(TOKEN_DELIMITER);
  if (parts.length !== 4) {
    return { valid: false };
  }

  const [playerId, roomCode, sessionStr] = parts;
  const session = Number(sessionStr);

  if (!playerId || !roomCode || Number.isNaN(session)) {
    return { valid: false };
  }

  if (session !== expectedSession) {
    logger.warn('Auth token session mismatch', {
      tokenSession: session,
      expectedSession,
      playerId,
      roomCode,
    });
    // Keep extracted fields so callers can distinguish SESSION_EXPIRED
    // from a malformed token (which returns no session).
    return { valid: false, playerId, roomCode, session };
  }

  return {
    valid: true,
    playerId,
    roomCode,
    session,
  };
}

/**
 * Generate a host token (separate from player auth tokens).
 *
 * The host token is generated once at room-creation time and stored in
 * `rooms.host_token`.  It is sent back to the host client (in the
 * room-creation response) and must be presented on every host action to
 * prove the client is authorised to control the room.
 */
export function generateHostToken(): string {
  return `host:${uuidv4().replace(/-/g, '')}`;
}
