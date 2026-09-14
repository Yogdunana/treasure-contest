import { getDb } from '../connection.js';
import type { Gem, PlayerMission } from '@treasure-contest/shared';

// ============================================================================
// DB Row Types
// ============================================================================

export interface PlayerRow {
  id: string;
  room_code: string;
  name: string;
  seat_number: number;
  auth_token: string;
  cookie_token: string | null;
  browser_fingerprint: string | null;
  socket_id: string | null;
  is_connected: number;
  is_ready: number;
  is_in_queue: number;
  queue_position: number | null;
  available_numbers: string;
  used_numbers: string;
  round_submission: string | null;
  gems_json: string;
  missions_json: string;
  final_score: number;
  final_rank: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Domain Types
// ============================================================================

export interface PlayerRecord {
  id: string;
  roomCode: string;
  name: string;
  seatNumber: number;
  authToken: string;
  cookieToken: string | null;
  browserFingerprint: string | null;
  socketId: string | null;
  isConnected: boolean;
  isReady: boolean;
  isInQueue: boolean;
  queuePosition: number | null;
  availableNumbers: number[];
  usedNumbers: number[];
  roundSubmission: number | null;
  gems: Gem[];
  missions: PlayerMission[];
  finalScore: number;
  finalRank: number | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Mappers
// ============================================================================

function parseJSON<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapRowToRecord(row: PlayerRow): PlayerRecord {
  return {
    id: row.id,
    roomCode: row.room_code,
    name: row.name,
    seatNumber: row.seat_number,
    authToken: row.auth_token,
    cookieToken: row.cookie_token,
    browserFingerprint: row.browser_fingerprint,
    socketId: row.socket_id,
    isConnected: row.is_connected === 1,
    isReady: row.is_ready === 1,
    isInQueue: row.is_in_queue === 1,
    queuePosition: row.queue_position,
    availableNumbers: parseJSON(row.available_numbers, [1, 2, 3, 4, 5, 6, 7]),
    usedNumbers: parseJSON(row.used_numbers, []),
    roundSubmission: row.round_submission === null ? null : Number(row.round_submission),
    gems: parseJSON(row.gems_json, []),
    missions: parseJSON(row.missions_json, []),
    finalScore: row.final_score,
    finalRank: row.final_rank,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Repository functions
// ============================================================================

/**
 * Create a new player row inside a room.
 *
 * @param id            Player UUID (generated externally).
 * @param roomCode      The room the player is joining.
 * @param name          Player display name.
 * @param seatNumber    Assigned seat (1-based).
 * @param authToken     Reconnect auth token.
 * @param fingerprint   Optional browser fingerprint for Layer-3 reconnect.
 */
export function createPlayer(
  id: string,
  roomCode: string,
  name: string,
  seatNumber: number,
  authToken: string,
  fingerprint?: string | null,
): PlayerRecord {
  const db = getDb();
  db.prepare(
    `INSERT INTO players (id, room_code, name, seat_number, auth_token, browser_fingerprint, is_connected, is_ready, is_in_queue, available_numbers, used_numbers, final_score)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, '[1,2,3,4,5,6,7]', '[]', 0)`,
  ).run(id, roomCode, name, seatNumber, authToken, fingerprint ?? null);

  return getPlayer(id)!;
}

/**
 * Fetch a single player by primary key.
 */
export function getPlayer(id: string): PlayerRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id) as PlayerRow | undefined;
  return row ? mapRowToRecord(row) : null;
}

/**
 * Fetch a player by room + seat number.
 */
export function getPlayerByRoomAndSeat(roomCode: string, seatNumber: number): PlayerRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM players WHERE room_code = ? AND seat_number = ?')
    .get(roomCode, seatNumber) as PlayerRow | undefined;
  return row ? mapRowToRecord(row) : null;
}

/**
 * Fetch a player by room + browser fingerprint (Layer-3 reconnect).
 */
export function getPlayerByFingerprint(roomCode: string, fingerprint: string): PlayerRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM players WHERE room_code = ? AND browser_fingerprint = ?')
    .get(roomCode, fingerprint) as PlayerRow | undefined;
  return row ? mapRowToRecord(row) : null;
}

/**
 * Fetch a player by room + name + seat (Layer-4 manual reconnect).
 */
export function getPlayerByNameAndSeat(
  roomCode: string,
  name: string,
  seatNumber: number,
): PlayerRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM players WHERE room_code = ? AND name = ? AND seat_number = ?')
    .get(roomCode, name, seatNumber) as PlayerRow | undefined;
  return row ? mapRowToRecord(row) : null;
}

/**
 * Update the socket ID associated with a player (called on connect/reconnect).
 */
export function updatePlayerSocket(id: string, socketId: string | null): void {
  const db = getDb();
  db.prepare('UPDATE players SET socket_id = ? WHERE id = ?').run(socketId, id);
}

/**
 * Update the connection status of a player.
 */
export function updatePlayerConnection(id: string, isConnected: boolean): void {
  const db = getDb();
  db.prepare('UPDATE players SET is_connected = ? WHERE id = ?').run(isConnected ? 1 : 0, id);
}

/**
 * Partial update of a player's game state fields.
 *
 * Only the provided fields are written; the rest remain unchanged.
 */
export function updatePlayerState(
  id: string,
  data: Partial<{
    isReady: boolean;
    isInQueue: boolean;
    queuePosition: number | null;
    availableNumbers: number[];
    usedNumbers: number[];
    roundSubmission: number | null;
    gems: Gem[];
    missions: PlayerMission[];
    finalScore: number;
    finalRank: number | null;
    cookieToken: string | null;
    browserFingerprint: string | null;
  }>,
): void {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.isReady !== undefined) {
    sets.push('is_ready = ?');
    values.push(data.isReady ? 1 : 0);
  }
  if (data.isInQueue !== undefined) {
    sets.push('is_in_queue = ?');
    values.push(data.isInQueue ? 1 : 0);
  }
  if (data.queuePosition !== undefined) {
    sets.push('queue_position = ?');
    values.push(data.queuePosition);
  }
  if (data.availableNumbers !== undefined) {
    sets.push('available_numbers = ?');
    values.push(JSON.stringify(data.availableNumbers));
  }
  if (data.usedNumbers !== undefined) {
    sets.push('used_numbers = ?');
    values.push(JSON.stringify(data.usedNumbers));
  }
  if (data.roundSubmission !== undefined) {
    sets.push('round_submission = ?');
    values.push(data.roundSubmission);
  }
  if (data.gems !== undefined) {
    sets.push('gems_json = ?');
    values.push(JSON.stringify(data.gems));
  }
  if (data.missions !== undefined) {
    sets.push('missions_json = ?');
    values.push(JSON.stringify(data.missions));
  }
  if (data.finalScore !== undefined) {
    sets.push('final_score = ?');
    values.push(data.finalScore);
  }
  if (data.finalRank !== undefined) {
    sets.push('final_rank = ?');
    values.push(data.finalRank);
  }
  if (data.cookieToken !== undefined) {
    sets.push('cookie_token = ?');
    values.push(data.cookieToken);
  }
  if (data.browserFingerprint !== undefined) {
    sets.push('browser_fingerprint = ?');
    values.push(data.browserFingerprint);
  }

  if (sets.length === 0) return;

  values.push(id);
  const db = getDb();
  db.prepare(`UPDATE players SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

/**
 * Return all players in a room, ordered by seat number.
 */
export function getPlayersByRoom(roomCode: string): PlayerRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM players WHERE room_code = ? ORDER BY seat_number ASC')
    .all(roomCode) as PlayerRow[];
  return rows.map(mapRowToRecord);
}

/**
 * Delete all players belonging to a room (used on room teardown).
 */
export function deletePlayersByRoom(roomCode: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM players WHERE room_code = ?').run(roomCode);
  return result.changes;
}
