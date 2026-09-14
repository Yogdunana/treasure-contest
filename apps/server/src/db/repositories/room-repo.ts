import { getDb } from '../connection.js';
import type { GamePhase } from '@treasure-contest/shared';

// ============================================================================
// DB Row Types (raw SQLite columns — snake_case, JSON fields as strings)
// ============================================================================

export interface RoomRow {
  code: string;
  host_name: string;
  host_token: string;
  host_id: string | null;
  screen_id: string | null;
  phase: GamePhase;
  current_round: number;
  game_session: number;
  target_players: number;
  is_paused: number;
  paused_phase: GamePhase | null;
  timer_remaining: number | null;
  timer_deadline: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Domain Types (camelCase, ready for the game-logic layer to consume)
// ============================================================================

export interface RoomRecord {
  code: string;
  hostName: string;
  hostToken: string;
  hostId: string | null;
  screenId: string | null;
  phase: GamePhase;
  currentRound: number;
  gameSession: number;
  targetPlayers: number;
  isPaused: boolean;
  pausedPhase: GamePhase | null;
  timerRemaining: number | null;
  timerDeadline: number | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Mappers
// ============================================================================

function mapRowToRecord(row: RoomRow): RoomRecord {
  return {
    code: row.code,
    hostName: row.host_name,
    hostToken: row.host_token,
    hostId: row.host_id,
    screenId: row.screen_id,
    phase: row.phase,
    currentRound: row.current_round,
    gameSession: row.game_session,
    targetPlayers: row.target_players,
    isPaused: row.is_paused === 1,
    pausedPhase: row.paused_phase,
    timerRemaining: row.timer_remaining,
    timerDeadline: row.timer_deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Repository functions
// ============================================================================

/**
 * Insert a new room row.
 *
 * @returns The created room record, or null on failure.
 */
export function createRoom(
  code: string,
  hostName: string,
  hostToken: string,
  targetPlayers: number,
): RoomRecord {
  const db = getDb();
  db.prepare(
    `INSERT INTO rooms (code, host_name, host_token, target_players, phase, current_round, game_session, is_paused)
     VALUES (?, ?, ?, ?, 'LOBBY', 0, 1, 0)`,
  ).run(code, hostName, hostToken, targetPlayers);

  return getRoom(code)!;
}

/**
 * Fetch a single room by its code.
 */
export function getRoom(code: string): RoomRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code) as RoomRow | undefined;
  return row ? mapRowToRecord(row) : null;
}

/**
 * Update the current phase of a room.
 */
export function updateRoomPhase(code: string, phase: GamePhase): void {
  const db = getDb();
  db.prepare('UPDATE rooms SET phase = ? WHERE code = ?').run(phase, code);
}

/**
 * Update arbitrary fields on a room (partial update).
 *
 * The `data` object uses domain (camelCase) keys; this function maps them
 * to the corresponding SQLite column names.
 */
export function updateRoom(
  code: string,
  data: Partial<{
    hostId: string | null;
    screenId: string | null;
    phase: GamePhase;
    currentRound: number;
    gameSession: number;
    targetPlayers: number;
    isPaused: boolean;
    pausedPhase: GamePhase | null;
    timerRemaining: number | null;
    timerDeadline: number | null;
  }>,
): void {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.hostId !== undefined) {
    sets.push('host_id = ?');
    values.push(data.hostId);
  }
  if (data.screenId !== undefined) {
    sets.push('screen_id = ?');
    values.push(data.screenId);
  }
  if (data.phase !== undefined) {
    sets.push('phase = ?');
    values.push(data.phase);
  }
  if (data.currentRound !== undefined) {
    sets.push('current_round = ?');
    values.push(data.currentRound);
  }
  if (data.gameSession !== undefined) {
    sets.push('game_session = ?');
    values.push(data.gameSession);
  }
  if (data.targetPlayers !== undefined) {
    sets.push('target_players = ?');
    values.push(data.targetPlayers);
  }
  if (data.isPaused !== undefined) {
    sets.push('is_paused = ?');
    values.push(data.isPaused ? 1 : 0);
  }
  if (data.pausedPhase !== undefined) {
    sets.push('paused_phase = ?');
    values.push(data.pausedPhase);
  }
  if (data.timerRemaining !== undefined) {
    sets.push('timer_remaining = ?');
    values.push(data.timerRemaining);
  }
  if (data.timerDeadline !== undefined) {
    sets.push('timer_deadline = ?');
    values.push(data.timerDeadline);
  }

  if (sets.length === 0) return;

  values.push(code);
  const db = getDb();
  db.prepare(`UPDATE rooms SET ${sets.join(', ')} WHERE code = ?`).run(...values);
}

/**
 * Increment the `game_session` counter for a room.
 *
 * Used when restarting a game to invalidate old reconnect tokens
 * (cross-game isolation).
 */
export function incrementGameSession(code: string): number {
  const db = getDb();
  const result = db
    .prepare('UPDATE rooms SET game_session = game_session + 1 WHERE code = ?')
    .run(code);
  // better-sqlite3 run() returns changes; fetch the new value.
  void result;
  const row = db
    .prepare('SELECT game_session FROM rooms WHERE code = ?')
    .get(code) as { game_session: number };
  return row.game_session;
}

/**
 * Return all rooms (e.g. for an admin dashboard).
 */
export function getAllRooms(): RoomRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM rooms ORDER BY created_at DESC').all() as RoomRow[];
  return rows.map(mapRowToRecord);
}

/**
 * Return all rooms whose phase is not `GAME_OVER` (i.e. still active).
 */
export function getActiveRooms(): RoomRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM rooms WHERE phase != 'GAME_OVER' ORDER BY created_at DESC")
    .all() as RoomRow[];
  return rows.map(mapRowToRecord);
}
