import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../connection.js';
import type { GameEvent, GamePhase } from '@treasure-contest/shared';

// ============================================================================
// DB Row Types
// ============================================================================

export interface HistoryRow {
  id: string;
  room_code: string;
  round_number: number | null;
  phase: GamePhase;
  event_type: string;
  player_id: string | null;
  event_data: string;
  created_at: string;
}

// ============================================================================
// Mappers
// ============================================================================

function mapRowToGameEvent(row: HistoryRow): GameEvent {
  let data: unknown = {};
  try {
    data = JSON.parse(row.event_data);
  } catch {
    data = {};
  }
  return {
    id: row.id,
    roomCode: row.room_code,
    round: row.round_number,
    phase: row.phase,
    eventType: row.event_type,
    playerId: row.player_id,
    data,
    timestamp: row.created_at,
  };
}

// ============================================================================
// Repository functions
// ============================================================================

/**
 * Append a new event to the game history log.
 *
 * @returns The created GameEvent.
 */
export function addHistory(
  roomCode: string,
  roundNumber: number | null,
  phase: GamePhase,
  eventType: string,
  playerId: string | null,
  eventData: unknown,
): GameEvent {
  const db = getDb();
  const id = uuidv4();
  const dataJson =
    typeof eventData === 'string' ? eventData : JSON.stringify(eventData ?? {});

  db.prepare(
    `INSERT INTO game_history (id, room_code, round_number, phase, event_type, player_id, event_data)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, roomCode, roundNumber, phase, eventType, playerId, dataJson);

  return getHistoryById(id)!;
}

/** Internal helper to fetch a single history row by ID. */
function getHistoryById(id: string): GameEvent | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM game_history WHERE id = ?')
    .get(id) as HistoryRow | undefined;
  return row ? mapRowToGameEvent(row) : null;
}

/**
 * Return all history events for a room (newest first).
 */
export function getHistoryByRoom(roomCode: string): GameEvent[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM game_history WHERE room_code = ? ORDER BY created_at DESC')
    .all(roomCode) as HistoryRow[];
  return rows.map(mapRowToGameEvent);
}

/**
 * Return history events for a room filtered by event type.
 */
export function getHistoryByRoomAndEvent(roomCode: string, eventType: string): GameEvent[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM game_history WHERE room_code = ? AND event_type = ? ORDER BY created_at DESC',
    )
    .all(roomCode, eventType) as HistoryRow[];
  return rows.map(mapRowToGameEvent);
}

/**
 * Count how many games were played today (based on `game_end` events).
 */
export function getTodayGameCount(): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM game_history
       WHERE event_type = 'game_end'
         AND DATE(created_at) = DATE('now')`,
    )
    .get() as { cnt: number };
  return row.cnt;
}

/** Aggregate row for today's statistics. */
export interface TodayStats {
  totalGames: number;
  totalPlayers: number;
  totalEvents: number;
}

/**
 * Return a summary of today's activity.
 */
export function getTodayStats(): TodayStats {
  const db = getDb();

  const gamesRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM game_history
       WHERE event_type = 'game_end'
         AND DATE(created_at) = DATE('now')`,
    )
    .get() as { cnt: number };

  const playersRow = db
    .prepare(
      `SELECT COUNT(DISTINCT player_id) AS cnt
       FROM game_history
       WHERE player_id IS NOT NULL
         AND DATE(created_at) = DATE('now')`,
    )
    .get() as { cnt: number };

  const eventsRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM game_history
       WHERE DATE(created_at) = DATE('now')`,
    )
    .get() as { cnt: number };

  return {
    totalGames: gamesRow.cnt,
    totalPlayers: playersRow.cnt,
    totalEvents: eventsRow.cnt,
  };
}

/** A single player's final result extracted from game_history. */
export interface GameResultRow {
  roomCode: string;
  playerId: string;
  playerName: string;
  finalScore: number;
  finalRank: number;
  gameSession: number;
  roundNumber: number | null;
  phase: GamePhase;
  eventType: string;
  createdAt: string;
}

/**
 * Return the results of all players in a given game session.
 *
 * This queries the `final_result` event type stored when the game ends.
 */
export function getGameResults(gameSession: number): GameResultRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT h.room_code, h.player_id, h.round_number, h.phase, h.event_type, h.created_at,
              p.name AS player_name,
              p.final_score,
              p.final_rank,
              r.game_session
       FROM game_history h
       JOIN players p ON p.id = h.player_id
       JOIN rooms r ON r.code = h.room_code
       WHERE h.event_type = 'final_result'
         AND r.game_session = ?
       ORDER BY p.final_rank ASC`,
    )
    .all(gameSession) as (HistoryRow & {
      player_name: string;
      final_score: number;
      final_rank: number;
      game_session: number;
    })[];

  return rows.map((r) => ({
    roomCode: r.room_code,
    playerId: r.player_id!,
    playerName: r.player_name,
    finalScore: r.final_score,
    finalRank: r.final_rank ?? 0,
    gameSession: r.game_session,
    roundNumber: r.round_number,
    phase: r.phase,
    eventType: r.event_type,
    createdAt: r.created_at,
  }));
}

/** Aggregate row for mission statistics. */
export interface MissionStatRow {
  missionId: string;
  difficulty: string;
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
}

/**
 * Return completion statistics for all missions across all games.
 *
 * This aggregates the `mission_result` events stored in game_history.
 */
export function getMissionStats(): MissionStatRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         json_extract(event_data, '$.missionId') AS mission_id,
         json_extract(event_data, '$.difficulty')  AS difficulty,
         COUNT(*) AS total_assigned,
         SUM(CASE WHEN json_extract(event_data, '$.completed') = 1 THEN 1 ELSE 0 END) AS total_completed
       FROM game_history
       WHERE event_type = 'mission_result'
       GROUP BY mission_id
       ORDER BY difficulty ASC, mission_id ASC`,
    )
    .all() as {
      mission_id: string;
      difficulty: string;
      total_assigned: number;
      total_completed: number;
    }[];

  return rows.map((r) => ({
    missionId: r.mission_id,
    difficulty: r.difficulty,
    totalAssigned: r.total_assigned,
    totalCompleted: r.total_completed,
    completionRate:
      r.total_assigned > 0 ? r.total_completed / r.total_assigned : 0,
  }));
}

/** Aggregate row for per-player statistics. */
export interface PlayerStatRow {
  playerId: string;
  playerName: string;
  gamesPlayed: number;
  totalScore: number;
  bestRank: number | null;
  avgScore: number;
}

/**
 * Return lifetime statistics for all players.
 */
export function getPlayerStats(): PlayerStatRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         p.id AS player_id,
         p.name AS player_name,
         COUNT(DISTINCT r.code) AS games_played,
         COALESCE(SUM(p.final_score), 0) AS total_score,
         MIN(p.final_rank) AS best_rank
       FROM players p
       JOIN rooms r ON r.code = p.room_code
       WHERE r.phase = 'GAME_OVER'
       GROUP BY p.id
       ORDER BY games_played DESC, total_score DESC`,
    )
    .all() as {
      player_id: string;
      player_name: string;
      games_played: number;
      total_score: number;
      best_rank: number | null;
    }[];

  return rows.map((r) => ({
    playerId: r.player_id,
    playerName: r.player_name,
    gamesPlayed: r.games_played,
    totalScore: r.total_score,
    bestRank: r.best_rank,
    avgScore: r.games_played > 0 ? r.total_score / r.games_played : 0,
  }));
}
