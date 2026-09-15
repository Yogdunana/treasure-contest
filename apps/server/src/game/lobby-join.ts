import { QUEUE_CONFIG } from '@treasure-contest/shared';

/**
 * Decision for a player attempting to join a room that is still in LOBBY.
 *
 * Reclaiming a disconnected seat with the same name always wins over
 * treating the room as full / pushing the joiner into the waiting queue.
 */
export type LobbyJoinDecision =
  | { action: 'reconnect'; playerId: string }
  | { action: 'join_new'; evictPlayerId?: string }
  | { action: 'name_taken' }
  | { action: 'queue' }
  | { action: 'queue_full' };

export function normalizePlayerName(name: string): string {
  return name.trim();
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export function findPlayerByName<T extends { name: string }>(
  players: Iterable<T>,
  playerName: string,
): T | undefined {
  const normalized = normalizePlayerName(playerName);
  if (!normalized) return undefined;
  for (const player of players) {
    if (normalizePlayerName(player.name) === normalized) {
      return player;
    }
  }
  return undefined;
}

/**
 * Decide how a lobby join should be handled.
 *
 * Order of precedence:
 * 1. Same name as a disconnected seat-holder → reclaim that seat.
 * 2. Same name as a connected player → NAME_TAKEN.
 * 3. Connected count below target → new player. If leftover disconnected
 *    seats are filling the roster (post-restart mass-disconnect), evict
 *    one so the joiner sits instead of entering the waiting queue.
 * 4. Enough players already connected → waiting queue (or QUEUE_FULL).
 */
export function decideLobbyJoin(input: {
  players: Iterable<{ id: string; name: string; isConnected: boolean; seatNumber?: number }>;
  playerName: string;
  targetPlayers: number;
  queueLength: number;
  maxQueueSize?: number;
}): LobbyJoinDecision {
  const maxQueue = input.maxQueueSize ?? QUEUE_CONFIG.MAX_QUEUE_SIZE;
  const seated = Array.from(input.players);
  const existing = findPlayerByName(seated, input.playerName);

  if (existing) {
    if (!existing.isConnected) {
      return { action: 'reconnect', playerId: existing.id };
    }
    return { action: 'name_taken' };
  }

  const connectedCount = seated.filter((p) => p.isConnected).length;
  if (connectedCount < input.targetPlayers) {
    if (seated.length >= input.targetPlayers) {
      const victim = pickDisconnectedSeatToEvict(seated);
      if (victim) {
        return { action: 'join_new', evictPlayerId: victim.id };
      }
    }
    return { action: 'join_new' };
  }

  if (input.queueLength >= maxQueue) {
    return { action: 'queue_full' };
  }

  return { action: 'queue' };
}

function pickDisconnectedSeatToEvict(
  seated: { id: string; isConnected: boolean; seatNumber?: number }[],
): { id: string } | undefined {
  const disconnected = seated.filter((p) => !p.isConnected);
  if (disconnected.length === 0) return undefined;
  disconnected.sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0));
  return disconnected[0];
}
