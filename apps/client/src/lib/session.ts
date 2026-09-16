/**
 * Persist Layer-2 reconnect cookies via HTTP.
 * Socket.io cannot Set-Cookie, so the client calls this after a successful
 * join / reconnect acknowledgement.
 */
export async function persistPlayerSession(
  playerId: string,
  roomCode: string,
  authToken: string,
): Promise<void> {
  try {
    await fetch('/api/session/player', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, roomCode, authToken }),
    });
  } catch {
    // Cookie persist is best-effort; Layer-1 localStorage still works.
  }
}

/** Clear Layer-2 reconnect cookies after an explicit leave or host kick. */
export async function clearPlayerSession(): Promise<void> {
  try {
    await fetch('/api/session/player', {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    // Best-effort; localStorage clear is the important part.
  }
}
