import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/connection.js';
import { getTodayGameCount, getMissionStats } from '../db/repositories/history-repo.js';
import { ALL_MISSIONS } from '@treasure-contest/shared';
import type { PlayerMission } from '@treasure-contest/shared';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Mission metadata lookup (built once from the shared mission pool)
// ============================================================================

const MISSION_LOOKUP = new Map(ALL_MISSIONS.map((m) => [m.id, m]));

// ============================================================================
// Response Types
// ============================================================================

/** Today's overview statistics returned by GET /api/admin/stats */
interface StatsResponse {
  totalSessions: number;
  totalPlayers: number;
  avgDuration: number;
  avgPlayers: number;
}

/** A single player's result inside a game record */
interface GamePlayerResult {
  id: string;
  name: string;
  seatNumber: number;
  finalScore: number;
  finalRank: number | null;
  missions: PlayerMission[];
}

/** A game session record returned by GET /api/admin/games */
interface GameRecord {
  roomCode: string;
  gameSession: number;
  hostName: string;
  phase: string;
  currentRound: number;
  targetPlayers: number;
  createdAt: string;
  updatedAt: string;
  startTime: string;
  endTime: string;
  duration: number;
  playerCount: number;
  players: GamePlayerResult[];
}

/** Mission completion statistics returned by GET /api/admin/missions */
interface MissionStat {
  missionId: string;
  title: string;
  difficulty: string;
  reward: number;
  appearedCount: number;
  completedCount: number;
  completionRate: number;
}

/** Player lifetime statistics returned by GET /api/admin/players */
interface PlayerStat {
  name: string;
  gamesPlayed: number;
  avgRank: number;
  totalScore: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert SQLite `datetime('now')` UTC text into an ISO-8601 string.
 */
function sqliteUtcToIso(value: string): string {
  if (!value) return '';
  if (value.includes('T')) return value.endsWith('Z') ? value : `${value}Z`;
  return `${value.replace(' ', 'T')}Z`;
}

/**
 * Escape a value for inclusion in a CSV field.
 * Wraps in double-quotes if the value contains a comma, quote, or newline.
 */
function csvEscape(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Round to 2 decimal places, returning 0 for null/NaN.
 */
function round2(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Aggregate mission appearance and completion from `mission_result` history
 * events so stats survive host restart (live missions_json is wiped).
 */
function aggregateMissionStats(): Map<string, { appearedCount: number; completedCount: number }> {
  const stats = new Map<string, { appearedCount: number; completedCount: number }>();
  for (const row of getMissionStats()) {
    stats.set(row.missionId, {
      appearedCount: row.totalAssigned,
      completedCount: row.totalCompleted,
    });
  }
  return stats;
}

// ============================================================================
// Admin Authentication
// ============================================================================

/** Token expiry: 8 hours (a full event day). */
const TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000;

/** Name of the auth cookie. */
const ADMIN_COOKIE_NAME = 'tc_admin_token';

/**
 * Create a signed token: base64(payload) + HMAC-SHA256 signature.
 * Payload contains expiry timestamp only (stateless, no user identity needed).
 */
function createAdminToken(): string {
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_EXPIRY_MS });
  const payloadB64 = Buffer.from(payload, 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', config.adminJwtSecret)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

/**
 * Verify a signed token. Returns true if the token is valid and not expired.
 */
function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', config.adminJwtSecret)
    .update(payloadB64)
    .digest('base64url');

  // Use timingSafeEqual to prevent timing attacks.
  try {
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return false;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
  } catch {
    return false;
  }

  // Check expiry.
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Express middleware: reject requests that lack a valid admin token.
 *
 * The token is read from either:
 * 1. The `tc_admin_token` HTTP-only cookie (set on login), or
 * 2. The `Authorization: Bearer <token>` header (for API-only usage).
 */
function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  // Check cookie first.
  const cookieToken = req.cookies?.[ADMIN_COOKIE_NAME];
  if (cookieToken && verifyAdminToken(cookieToken)) {
    next();
    return;
  }

  // Check Authorization header.
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const headerToken = authHeader.slice(7);
    if (verifyAdminToken(headerToken)) {
      next();
      return;
    }
  }

  res.status(401).json({ error: '未授权，请先登录' });
}

// ============================================================================
// Route factory
// ============================================================================

/**
 * Create the admin API router.
 *
 * Endpoints:
 *   GET /api/admin/stats    - Today's overview statistics
 *   GET /api/admin/games    - Today's game records with player results
 *   GET /api/admin/missions - Mission completion statistics
 *   GET /api/admin/players  - Player lifetime statistics
 *   GET /api/admin/export   - Export all data as CSV
 */
export function createAdminRouter(): Router {
  const router = Router();

  // -- POST /login ----------------------------------------------------------
  // Authenticate with a password and receive an HTTP-only cookie + JSON token.
  // This route is public (no auth middleware) — it IS the auth entry point.
  router.post('/login', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };

    if (!password) {
      res.status(400).json({ error: '请输入密码' });
      return;
    }

    // Prevent brute-force: constant-time comparison.
    const provided = Buffer.from(String(password));
    const expected = Buffer.from(config.adminPassword);
    const isValid =
      provided.length === expected.length &&
      crypto.timingSafeEqual(provided, expected);

    if (!isValid) {
      res.status(401).json({ error: '密码错误' });
      return;
    }

    const token = createAdminToken();

    // Set HTTP-only cookie for browser-based dashboard.
    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'strict' : 'lax',
      maxAge: TOKEN_EXPIRY_MS,
      path: '/',
    });

    // Also return token in JSON for non-browser clients.
    res.json({ success: true, token });
  });

  // -- POST /logout ---------------------------------------------------------
  router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
    res.json({ success: true });
  });

  // -- GET /check -----------------------------------------------------------
  // Lightweight endpoint to check if the current cookie/token is valid.
  router.get('/check', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({ authenticated: true });
  });

  // ── All routes below require authentication ────────────────────────────
  router.use(requireAdminAuth);

  // -- GET /stats -----------------------------------------------------------
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const db = getDb();

      // Today's total game sessions (count of game_end events today)
      const totalSessions = getTodayGameCount();

      // Today's unique players
      const playersRow = db
        .prepare(
          `SELECT COUNT(DISTINCT name) AS cnt
             FROM players
            WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')`,
        )
        .get() as { cnt: number };

      // Average game duration in seconds (from game_start to game_end events)
      const durationRow = db
        .prepare(
          `SELECT AVG(duration) AS avg_duration
             FROM (
               SELECT room_code,
                      (julianday(MAX(CASE WHEN event_type = 'game_end'   THEN created_at END))
                       - julianday(MIN(CASE WHEN event_type = 'game_start' THEN created_at END))
                      ) * 86400 AS duration
                 FROM game_history
                WHERE event_type IN ('game_start', 'game_end')
                  AND DATE(created_at, 'localtime') = DATE('now', 'localtime')
                GROUP BY room_code
             )
            WHERE duration IS NOT NULL`,
        )
        .get() as { avg_duration: number | null };

      // Average players per room today
      const avgPlayersRow = db
        .prepare(
          `SELECT AVG(player_count) AS avg_players
             FROM (
               SELECT r.code, COUNT(p.id) AS player_count
                 FROM rooms r
                 JOIN players p ON p.room_code = r.code
                WHERE DATE(r.created_at, 'localtime') = DATE('now', 'localtime')
                GROUP BY r.code
             )`,
        )
        .get() as { avg_players: number | null };

      const response: StatsResponse = {
        totalSessions,
        totalPlayers: playersRow.cnt,
        avgDuration: round2(durationRow.avg_duration),
        avgPlayers: round2(avgPlayersRow.avg_players),
      };

      res.json(response);
    } catch (err) {
      logger.error('Admin stats error', err);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // -- GET /games -----------------------------------------------------------
  router.get('/games', (_req: Request, res: Response) => {
    try {
      const db = getDb();

      // Fetch all rooms created today
      const rooms = db
        .prepare(
          `SELECT code, game_session, host_name, phase, current_round,
                  target_players, created_at, updated_at
             FROM rooms
            WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
            ORDER BY created_at DESC`,
        )
        .all() as Array<{
          code: string;
          game_session: number;
          host_name: string;
          phase: string;
          current_round: number;
          target_players: number;
          created_at: string;
          updated_at: string;
        }>;

      // Fetch all players for today's rooms in a single query
      const roomCodes = rooms.map((r) => r.code);

      let playerRows: Array<{
        id: string;
        room_code: string;
        name: string;
        seat_number: number;
        final_score: number;
        final_rank: number | null;
        missions_json: string;
      }> = [];

      if (roomCodes.length > 0) {
        const placeholders = roomCodes.map(() => '?').join(',');
        playerRows = db
          .prepare(
            `SELECT id, room_code, name, seat_number, final_score, final_rank, missions_json
               FROM players
              WHERE room_code IN (${placeholders})
              ORDER BY room_code, final_rank ASC`,
          )
          .all(...roomCodes) as typeof playerRows;
      }

      // Group players by room code
      const playersByRoom = new Map<string, GamePlayerResult[]>();
      for (const p of playerRows) {
        if (!playersByRoom.has(p.room_code)) {
          playersByRoom.set(p.room_code, []);
        }
        let missions: PlayerMission[] = [];
        try {
          const parsed = JSON.parse(p.missions_json || '[]') as PlayerMission[];
          if (Array.isArray(parsed)) missions = parsed;
        } catch {
          missions = [];
        }
        playersByRoom.get(p.room_code)!.push({
          id: p.id,
          name: p.name,
          seatNumber: p.seat_number,
          finalScore: p.final_score,
          finalRank: p.final_rank,
          missions,
        });
      }

      // Assemble game records
      const games: GameRecord[] = rooms.map((r) => {
        const players = playersByRoom.get(r.code) ?? [];
        const startIso = sqliteUtcToIso(r.created_at);
        const endIso = sqliteUtcToIso(r.updated_at);
        const startMs = Date.parse(startIso);
        const endMs = Date.parse(endIso);
        const duration =
          Number.isFinite(startMs) && Number.isFinite(endMs)
            ? Math.max(0, Math.round((endMs - startMs) / 1000))
            : 0;
        return {
          roomCode: r.code,
          gameSession: r.game_session,
          hostName: r.host_name,
          phase: r.phase,
          currentRound: r.current_round,
          targetPlayers: r.target_players,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          startTime: startIso,
          endTime: endIso,
          duration,
          playerCount: players.length,
          players,
        };
      });

      res.json(games);
    } catch (err) {
      logger.error('Admin games error', err);
      res.status(500).json({ error: 'Failed to fetch games' });
    }
  });

  // -- GET /missions --------------------------------------------------------
  router.get('/missions', (_req: Request, res: Response) => {
    try {
      const stats = aggregateMissionStats();

      // Build response with mission metadata from the shared pool
      const result: MissionStat[] = [];

      for (const [missionId, s] of stats) {
        const mission = MISSION_LOOKUP.get(missionId);
        result.push({
          missionId,
          title: mission?.title ?? 'Unknown',
          difficulty: mission?.difficulty ?? 'unknown',
          reward: mission?.reward ?? 0,
          appearedCount: s.appearedCount,
          completedCount: s.completedCount,
          completionRate:
            s.appearedCount > 0
              ? Math.round((s.completedCount / s.appearedCount) * 100) / 100
              : 0,
        });
      }

      // Sort by difficulty (easy < medium < hard) then by mission ID
      const difficultyOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
      result.sort((a, b) => {
        const diffA = difficultyOrder[a.difficulty] ?? 99;
        const diffB = difficultyOrder[b.difficulty] ?? 99;
        if (diffA !== diffB) return diffA - diffB;
        return a.missionId.localeCompare(b.missionId);
      });

      res.json(result);
    } catch (err) {
      logger.error('Admin missions error', err);
      res.status(500).json({ error: 'Failed to fetch mission stats' });
    }
  });

  // -- GET /players ---------------------------------------------------------
  router.get('/players', (_req: Request, res: Response) => {
    try {
      const db = getDb();

      const rows = db
        .prepare(
          `SELECT
             json_extract(event_data, '$.name') AS name,
             COUNT(*) AS games_played,
             AVG(json_extract(event_data, '$.finalRank')) AS avg_rank,
             COALESCE(SUM(json_extract(event_data, '$.finalScore')), 0) AS total_score
           FROM game_history
          WHERE event_type = 'final_result'
            AND json_extract(event_data, '$.name') IS NOT NULL
          GROUP BY json_extract(event_data, '$.name')
          ORDER BY games_played DESC, total_score DESC`,
        )
        .all() as Array<{
          name: string;
          games_played: number;
          avg_rank: number | null;
          total_score: number;
        }>;

      const players: PlayerStat[] = rows.map((r) => ({
        name: r.name,
        gamesPlayed: r.games_played,
        avgRank: round2(r.avg_rank),
        totalScore: r.total_score,
      }));

      res.json(players);
    } catch (err) {
      logger.error('Admin players error', err);
      res.status(500).json({ error: 'Failed to fetch player stats' });
    }
  });

  // -- GET /export -----------------------------------------------------------
  router.get('/export', (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const lines: string[] = [];

      // -- Section 1: Game records --
      lines.push('=== Game Records ===');
      lines.push(
        'Room Code,Game Session,Host Name,Phase,Current Round,Target Players,Start Time,End Time',
      );

      const rooms = db
        .prepare(
          `SELECT code, game_session, host_name, phase, current_round,
                  target_players, created_at, updated_at
             FROM rooms
            ORDER BY created_at DESC`,
        )
        .all() as Array<{
          code: string;
          game_session: number;
          host_name: string;
          phase: string;
          current_round: number;
          target_players: number;
          created_at: string;
          updated_at: string;
        }>;

      for (const r of rooms) {
        lines.push(
          [
            csvEscape(r.code),
            csvEscape(r.game_session),
            csvEscape(r.host_name),
            csvEscape(r.phase),
            csvEscape(r.current_round),
            csvEscape(r.target_players),
            csvEscape(sqliteUtcToIso(r.created_at)),
            csvEscape(sqliteUtcToIso(r.updated_at)),
          ].join(','),
        );
      }

      lines.push('');

      // -- Section 2: Player results --
      lines.push('=== Player Results ===');
      lines.push('Room Code,Player Name,Seat Number,Final Score,Final Rank');

      const playerRows = db
        .prepare(
          `SELECT p.room_code, p.name, p.seat_number, p.final_score, p.final_rank
             FROM players p
             JOIN rooms r ON r.code = p.room_code
            ORDER BY r.created_at DESC, p.final_rank ASC`,
        )
        .all() as Array<{
          room_code: string;
          name: string;
          seat_number: number;
          final_score: number;
          final_rank: number | null;
        }>;

      for (const p of playerRows) {
        lines.push(
          [
            csvEscape(p.room_code),
            csvEscape(p.name),
            csvEscape(p.seat_number),
            csvEscape(p.final_score),
            csvEscape(p.final_rank),
          ].join(','),
        );
      }

      lines.push('');

      // -- Section 3: Mission stats --
      lines.push('=== Mission Stats ===');
      lines.push('Mission ID,Title,Difficulty,Reward,Appeared Count,Completed Count,Completion Rate');

      const missionStats = aggregateMissionStats();

      // Sort by difficulty then mission ID (same logic as /missions endpoint)
      const difficultyOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
      const sortedMissionIds = [...missionStats.keys()].sort((a, b) => {
        const missionA = MISSION_LOOKUP.get(a);
        const missionB = MISSION_LOOKUP.get(b);
        const diffA = difficultyOrder[missionA?.difficulty ?? 'unknown'] ?? 99;
        const diffB = difficultyOrder[missionB?.difficulty ?? 'unknown'] ?? 99;
        if (diffA !== diffB) return diffA - diffB;
        return a.localeCompare(b);
      });

      for (const missionId of sortedMissionIds) {
        const s = missionStats.get(missionId)!;
        const mission = MISSION_LOOKUP.get(missionId);
        const rate =
          s.appearedCount > 0
            ? (s.completedCount / s.appearedCount).toFixed(2)
            : '0.00';
        lines.push(
          [
            csvEscape(missionId),
            csvEscape(mission?.title ?? 'Unknown'),
            csvEscape(mission?.difficulty ?? 'unknown'),
            csvEscape(mission?.reward ?? 0),
            csvEscape(s.appearedCount),
            csvEscape(s.completedCount),
            csvEscape(rate),
          ].join(','),
        );
      }

      const csv = lines.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="treasure-contest-export.csv"');
      res.send(csv);
    } catch (err) {
      logger.error('Admin export error', err);
      res.status(500).json({ error: 'Failed to export data' });
    }
  });

  return router;
}
