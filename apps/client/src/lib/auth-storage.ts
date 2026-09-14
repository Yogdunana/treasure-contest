/**
 * LocalStorage-backed auth persistence.
 *
 * When a player joins a room, the server issues an `authToken` and a
 * `playerId`.  We persist these along with the `roomCode` so that on a page
 * reload or brief disconnection we can attempt a Layer-1 reconnect via the
 * `room:reconnect` socket event before falling back to fingerprint or
 * name-based reconnection.
 *
 * The storage key is namespaced per room so that multiple tabs / different
 * rooms do not collide.
 */

import { generateFingerprint } from './fingerprint';

const STORAGE_PREFIX = 'tc_auth_';

/**
 * Shape of the persisted auth data.
 */
export interface AuthData {
  roomCode: string;
  playerId: string;
  authToken: string;
}

/**
 * Returns the localStorage key for a given room code.
 */
function storageKey(roomCode: string): string {
  return `${STORAGE_PREFIX}${roomCode}`;
}

/**
 * Persists auth credentials to localStorage.
 *
 * @param roomCode  The room the player belongs to.
 * @param playerId  The server-assigned player ID.
 * @param authToken The reconnect token issued by the server.
 */
export function saveAuthToLocal(
  roomCode: string,
  playerId: string,
  authToken: string,
): void {
  try {
    const data: AuthData = { roomCode, playerId, authToken };
    localStorage.setItem(storageKey(roomCode), JSON.stringify(data));
  } catch {
    // localStorage might be unavailable (private browsing, quota, etc.)
    // Fail silently — reconnect will fall back to fingerprint.
  }
}

/**
 * Reads the persisted auth data for a given room from localStorage.
 *
 * @returns The auth data if it exists and is valid, otherwise `null`.
 */
export function getAuthFromLocal(roomCode?: string): AuthData | null {
  try {
    if (roomCode) {
      const raw = localStorage.getItem(storageKey(roomCode));
      if (raw) {
        const data = JSON.parse(raw) as AuthData;
        if (data.roomCode && data.playerId && data.authToken) {
          return data;
        }
      }
    }

    // If no roomCode provided, try to find any stored auth entry.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw) as AuthData;
          if (data.roomCode && data.playerId && data.authToken) {
            return data;
          }
        }
      }
    }
  } catch {
    // Ignore parse / access errors
  }

  return null;
}

/**
 * Removes the persisted auth data for a given room.
 * If no roomCode is provided, removes ALL persisted auth entries.
 *
 * @param roomCode Optional room code; if omitted, clears all entries.
 */
export function clearAuthLocal(roomCode?: string): void {
  try {
    if (roomCode) {
      localStorage.removeItem(storageKey(roomCode));
      return;
    }

    // Clear all tc_auth_ keys
    const keysToRemove: string[] = [];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore access errors
  }
}

export { generateFingerprint };
