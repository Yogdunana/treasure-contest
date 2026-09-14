import type { Request, Response } from 'express';
import { config } from '../config.js';

/**
 * HTTP-only cookie helpers for Layer-2 reconnect.
 *
 * Two cookies are set:
 *   - `tc_player_id`  — the player UUID (so the server knows *who* to
 *                       reconnect).
 *   - `tc_room_code`  — the room code (so the server knows *where* to
 *                       reconnect).
 *
 * The auth token is NOT stored in a cookie — it lives in localStorage
 * (Layer-1) because cookies are sent on every HTTP request which would
 * waste bandwidth.  Cookie reconnect (Layer-2) is a fallback that works
 * even when localStorage has been cleared, relying on the player ID +
 * room code to look up the player row (which still stores the auth token
 * server-side).
 *
 * Cookies are:
 *   - HTTP-only (not readable by JS → XSS-safe).
 *   - SameSite=Lax (sent on top-level navigations).
 *   - Secure in production.
 *
 * Note: `@types/cookie-parser` augments the Express `Request` type with a
 * `cookies` record, so `req.cookies` is available without any custom type.
 */

/** Cookie names (kept short to stay within browser limits). */
export const COOKIE_NAMES = {
  playerId: 'tc_player_id',
  roomCode: 'tc_room_code',
} as const;

/** Default cookie options. */
function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // Only mark Secure on HTTPS. HTTP campus deploys would otherwise
    // never persist Layer-2 reconnect cookies.
    secure: config.cookieSecure,
    path: '/',
    maxAge: maxAgeMs,
  };
}

/** Cookie lifetime: 7 days (long enough for multi-day events). */
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Set the player-reconnect cookies on an HTTP response.
 *
 * @param res       Express Response object.
 * @param playerId  The player's UUID.
 * @param roomCode  The room code the player joined.
 */
export function setPlayerCookies(
  res: Response,
  playerId: string,
  roomCode: string,
): void {
  const opts = cookieOptions(COOKIE_MAX_AGE_MS);
  res.cookie(COOKIE_NAMES.playerId, playerId, opts);
  res.cookie(COOKIE_NAMES.roomCode, roomCode, opts);
}

/**
 * Read the player-reconnect cookies from an HTTP request.
 *
 * @returns The player ID and room code, or `null` if the cookies are absent.
 */
export function getPlayerCookies(req: Request): {
  playerId: string;
  roomCode: string;
} | null {
  const playerId = req.cookies?.[COOKIE_NAMES.playerId] as string | undefined;
  const roomCode = req.cookies?.[COOKIE_NAMES.roomCode] as string | undefined;

  if (!playerId || !roomCode) {
    return null;
  }

  return { playerId, roomCode };
}

/**
 * Clear the player-reconnect cookies (e.g. on explicit leave).
 */
export function clearPlayerCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.playerId, { path: '/' });
  res.clearCookie(COOKIE_NAMES.roomCode, { path: '/' });
}
