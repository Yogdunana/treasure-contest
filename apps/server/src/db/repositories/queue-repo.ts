import { getDb } from '../connection.js';
import type { QueueEntry } from '@treasure-contest/shared';

// ============================================================================
// DB Row Types
// ============================================================================

export interface QueueRow {
  id: string;
  room_code: string;
  player_name: string;
  fingerprint: string | null;
  cookie_token: string | null;
  socket_id: string | null;
  position: number;
  is_connected: number;
  joined_at: string;
}

// ============================================================================
// Mappers
// ============================================================================

function mapRowToQueueEntry(row: QueueRow): QueueEntry {
  return {
    id: row.id,
    roomCode: row.room_code,
    playerName: row.player_name,
    position: row.position,
    ...(row.socket_id !== null ? { socketId: row.socket_id } : {}),
    ...(row.fingerprint !== null ? { browserFingerprint: row.fingerprint } : {}),
    ...(row.cookie_token !== null ? { cookieToken: row.cookie_token } : {}),
    joinedAt: row.joined_at,
  };
}

// ============================================================================
// Repository functions
// ============================================================================

/**
 * Add a new entry to a room's waiting queue.
 *
 * The `position` is auto-assigned as (current max position + 1).
 */
export function addToQueue(
  id: string,
  roomCode: string,
  playerName: string,
  fingerprint?: string | null,
  cookieToken?: string | null,
): QueueEntry {
  const db = getDb();

  // Determine the next position.
  const row = db
    .prepare('SELECT COALESCE(MAX(position), 0) AS max_pos FROM waiting_queue WHERE room_code = ?')
    .get(roomCode) as { max_pos: number };
  const position = row.max_pos + 1;

  db.prepare(
    `INSERT INTO waiting_queue (id, room_code, player_name, fingerprint, cookie_token, position, is_connected)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
  ).run(id, roomCode, playerName, fingerprint ?? null, cookieToken ?? null, position);

  return getQueueEntry(id)!;
}

/**
 * Fetch a single queue entry by ID (internal helper).
 */
export function getQueueEntry(id: string): QueueEntry | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM waiting_queue WHERE id = ?')
    .get(id) as QueueRow | undefined;
  return row ? mapRowToQueueEntry(row) : null;
}

/**
 * Return all queue entries for a room, ordered by position.
 */
export function getQueueByRoom(roomCode: string): QueueEntry[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM waiting_queue WHERE room_code = ? ORDER BY position ASC')
    .all(roomCode) as QueueRow[];
  return rows.map(mapRowToQueueEntry);
}

/**
 * Set a specific position for a queue entry.
 */
export function updateQueuePosition(id: string, position: number): void {
  const db = getDb();
  db.prepare('UPDATE waiting_queue SET position = ? WHERE id = ?').run(position, id);
}

/**
 * Remove a queue entry and re-pack the remaining entries so positions stay
 * contiguous (1, 2, 3, …).
 */
export function removeFromQueue(id: string): void {
  const db = getDb();

  const entry = db
    .prepare('SELECT room_code, position FROM waiting_queue WHERE id = ?')
    .get(id) as { room_code: string; position: number } | undefined;

  if (!entry) return;

  db.prepare('DELETE FROM waiting_queue WHERE id = ?').run(id);

  // Shift everyone after this entry down by one.
  db.prepare(
    `UPDATE waiting_queue
       SET position = position - 1
     WHERE room_code = ? AND position > ?`,
  ).run(entry.room_code, entry.position);
}

/**
 * Count the number of entries in a room's queue.
 */
export function getQueueCount(roomCode: string): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) AS cnt FROM waiting_queue WHERE room_code = ?')
    .get(roomCode) as { cnt: number };
  return row.cnt;
}

/**
 * Return the front-of-queue entry (lowest position) for a room, or null
 * if the queue is empty.
 */
export function getNextInQueue(roomCode: string): QueueEntry | null {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT * FROM waiting_queue WHERE room_code = ? ORDER BY position ASC LIMIT 1',
    )
    .get(roomCode) as QueueRow | undefined;
  return row ? mapRowToQueueEntry(row) : null;
}
