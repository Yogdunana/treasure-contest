import { getDb } from '../connection.js';
import type { Gem, GemColor } from '@treasure-contest/shared';

// ============================================================================
// DB Row Types
// ============================================================================

export interface GemRow {
  id: string;
  room_code: string;
  round_number: number;
  color: GemColor;
  value: number;
  picked_by: string | null;
  pick_order: number | null;
  created_at: string;
}

// ============================================================================
// Mappers
// ============================================================================

function mapRowToGem(row: GemRow): Gem {
  return {
    id: row.id,
    color: row.color,
    value: row.value,
    ...(row.picked_by !== null ? { pickedBy: row.picked_by } : {}),
    ...(row.pick_order !== null ? { pickOrder: row.pick_order } : {}),
  };
}

// ============================================================================
// Repository functions
// ============================================================================

/**
 * Insert a new gem row for a round.
 */
export function createGem(
  id: string,
  roomCode: string,
  roundNumber: number,
  color: GemColor,
  value: number,
): Gem {
  const db = getDb();
  db.prepare(
    `INSERT INTO gems (id, room_code, round_number, color, value)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, roomCode, roundNumber, color, value);

  return getGem(id)!;
}

/**
 * Fetch a single gem by ID (helper used internally).
 */
export function getGem(id: string): Gem | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM gems WHERE id = ?').get(id) as GemRow | undefined;
  return row ? mapRowToGem(row) : null;
}

/**
 * Return all gems for a specific room + round.
 */
export function getGemsByRoomAndRound(roomCode: string, roundNumber: number): Gem[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM gems WHERE room_code = ? AND round_number = ? ORDER BY created_at ASC')
    .all(roomCode, roundNumber) as GemRow[];
  return rows.map(mapRowToGem);
}

/**
 * Record who picked a gem and in what order.
 */
export function updateGemPick(id: string, pickedBy: string, pickOrder: number): void {
  const db = getDb();
  db.prepare('UPDATE gems SET picked_by = ?, pick_order = ? WHERE id = ?').run(
    pickedBy,
    pickOrder,
    id,
  );
}

/**
 * Delete every gem row for a room (used on game restart).
 */
export function deleteGemsByRoom(roomCode: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM gems WHERE room_code = ?').run(roomCode);
  return result.changes;
}

/**
 * Return all gems ever generated for a room (across all rounds).
 */
export function getGemsByRoom(roomCode: string): Gem[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM gems WHERE room_code = ? ORDER BY round_number ASC, created_at ASC')
    .all(roomCode) as GemRow[];
  return rows.map(mapRowToGem);
}
