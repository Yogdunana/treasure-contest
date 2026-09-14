import { QUEUE_CONFIG } from '@treasure-contest/shared';

/**
 * Decision for a player attempting to join a room that is still in LOBBY.
 *
 * Reclaiming a disconnected seat with the same name always wins over
 * treating the room as full / pushing the joiner into the waiting queue.
 */
export type LobbyJoinDecision =
  | { action: 'reconnect'; playerId: string }
  | { action: 'join_new' }
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
 * 3. Empty seat below target capacity → new player.
 * 4. At capacity → waiting queue (or QUEUE_FULL).
 */
export function decideLobbyJoin(input: {
  players: Iterable<{ id: string; name: string; isConnected: boolean }>;
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

  const seatedCount = seated.length;
  if (seatedCount < input.targetPlayers) {
    return { action: 'join_new' };
  }

  if (input.queueLength >= maxQueue) {
    return { action: 'queue_full' };
  }

  return { action: 'queue' };
}
