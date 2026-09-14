/**
 * Full SQLite schema for the Treasure Contest game server.
 *
 * Tables:
 *   rooms         - A game room and its authoritative state
 *   players       - Individual players inside a room
 *   gems          - Gems generated per round (4 per round)
 *   waiting_queue - Players waiting to join a full room
 *   game_history  - Append-only event log for debugging & analytics
 *
 * All JSON fields are stored as TEXT and parsed on read.
 *
 * This is exported as a single SQL string so it can be executed with a single
 * `db.exec()` call on startup (see migrations.ts).
 */
export const SCHEMA_SQL = /* sql */ `
-- ============================================================================
-- rooms
-- ============================================================================
CREATE TABLE IF NOT EXISTS rooms (
  code              TEXT PRIMARY KEY,
  host_name         TEXT NOT NULL,
  host_token        TEXT NOT NULL,
  host_id           TEXT,
  screen_id         TEXT,
  phase             TEXT NOT NULL DEFAULT 'LOBBY',
  current_round     INTEGER NOT NULL DEFAULT 0,
  game_session      INTEGER NOT NULL DEFAULT 0,
  target_players    INTEGER NOT NULL DEFAULT 6,
  is_paused         INTEGER NOT NULL DEFAULT 0,
  paused_phase      TEXT,
  timer_remaining   INTEGER,
  timer_deadline    INTEGER,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- players
-- ============================================================================
CREATE TABLE IF NOT EXISTS players (
  id                    TEXT PRIMARY KEY,
  room_code             TEXT NOT NULL,
  name                  TEXT NOT NULL,
  seat_number           INTEGER NOT NULL,
  auth_token            TEXT NOT NULL,
  cookie_token          TEXT,
  browser_fingerprint   TEXT,
  socket_id             TEXT,
  is_connected          INTEGER NOT NULL DEFAULT 0,
  is_ready              INTEGER NOT NULL DEFAULT 0,
  is_in_queue           INTEGER NOT NULL DEFAULT 0,
  queue_position        INTEGER,
  available_numbers     TEXT NOT NULL DEFAULT '[1,2,3,4,5,6,7]',
  used_numbers          TEXT NOT NULL DEFAULT '[]',
  round_submission      TEXT,
  gems_json             TEXT NOT NULL DEFAULT '[]',
  missions_json         TEXT NOT NULL DEFAULT '[]',
  final_score           INTEGER NOT NULL DEFAULT 0,
  final_rank            INTEGER,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE,
  UNIQUE(room_code, seat_number),
  UNIQUE(room_code, name)
);

-- ============================================================================
-- gems
-- ============================================================================
CREATE TABLE IF NOT EXISTS gems (
  id            TEXT PRIMARY KEY,
  room_code     TEXT NOT NULL,
  round_number  INTEGER NOT NULL,
  color         TEXT NOT NULL,
  value         INTEGER NOT NULL,
  picked_by     TEXT,
  pick_order    INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE,
  UNIQUE(room_code, round_number, color)
);

-- ============================================================================
-- waiting_queue
-- ============================================================================
CREATE TABLE IF NOT EXISTS waiting_queue (
  id                  TEXT PRIMARY KEY,
  room_code           TEXT NOT NULL,
  player_name         TEXT NOT NULL,
  fingerprint         TEXT,
  cookie_token        TEXT,
  socket_id           TEXT,
  position            INTEGER NOT NULL,
  is_connected        INTEGER NOT NULL DEFAULT 0,
  joined_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE,
  UNIQUE(room_code, player_name)
);

-- ============================================================================
-- game_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS game_history (
  id          TEXT PRIMARY KEY,
  room_code   TEXT NOT NULL,
  round_number INTEGER,
  phase       TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  player_id   TEXT,
  event_data  TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_players_room_code     ON players(room_code);
CREATE INDEX IF NOT EXISTS idx_players_socket_id      ON players(socket_id);
CREATE INDEX IF NOT EXISTS idx_players_fingerprint     ON players(browser_fingerprint);
CREATE INDEX IF NOT EXISTS idx_gems_room_round        ON gems(room_code, round_number);
CREATE INDEX IF NOT EXISTS idx_gems_room              ON gems(room_code);
CREATE INDEX IF NOT EXISTS idx_queue_room             ON waiting_queue(room_code);
CREATE INDEX IF NOT EXISTS idx_queue_position         ON waiting_queue(room_code, position);
CREATE INDEX IF NOT EXISTS idx_history_room          ON game_history(room_code);
CREATE INDEX IF NOT EXISTS idx_history_room_event    ON game_history(room_code, event_type);
CREATE INDEX IF NOT EXISTS idx_history_event_type    ON game_history(event_type);
CREATE INDEX IF NOT EXISTS idx_history_created_at    ON game_history(created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_phase          ON rooms(phase);

-- ============================================================================
-- updated_at trigger for rooms
-- ============================================================================
CREATE TRIGGER IF NOT EXISTS trg_rooms_updated_at
AFTER UPDATE ON rooms
FOR EACH ROW
BEGIN
  UPDATE rooms SET updated_at = datetime('now') WHERE code = OLD.code;
END;

-- ============================================================================
-- updated_at trigger for players
-- ============================================================================
CREATE TRIGGER IF NOT EXISTS trg_players_updated_at
AFTER UPDATE ON players
FOR EACH ROW
BEGIN
  UPDATE players SET updated_at = datetime('now') WHERE id = OLD.id;
END;
`;
