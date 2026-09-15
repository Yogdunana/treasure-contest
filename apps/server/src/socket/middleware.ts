import { Server, Socket, type DefaultEventsMap } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ClientRole,
} from '@treasure-contest/shared';
import { logger } from '../utils/logger.js';

// ============================================================================
// SocketData: per-socket metadata attached during connection lifecycle
// ============================================================================

/**
 * Data attached to each Socket.io socket via `socket.data`.
 *
 * Populated by the middleware (cookies) and the connection handler (role,
 * room code, player ID, etc.) as the client progresses through the join or
 * reconnection flow.
 */
export interface SocketData {
  /** The room code the socket is associated with (set on join/reconnect). */
  roomCode?: string;
  /** The client role: player, screen, host, or queued (waiting queue). */
  role?: ClientRole | 'queued';
  /** The player UUID (set for player-role sockets after join/reconnect). */
  playerId?: string;
  /** Player ID from the HTTP-only cookie. Not proof of having joined. */
  cookiePlayerId?: string;
  /** Room code from the HTTP-only cookie. Not proof of having joined. */
  cookieRoomCode?: string;
  /** The host token (set for host-role sockets, used for verification). */
  hostToken?: string;
  /** The browser fingerprint provided by the client (Layer-3 reconnect). */
  fingerprint?: string;
  /** The queue entry ID (set for queued-role sockets). */
  queueEntryId?: string;
}

// ============================================================================
// Typed aliases for the Socket.io server and socket
// ============================================================================

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;

// ============================================================================
// Cookie parsing
// ============================================================================

/**
 * Parse a raw Cookie header string into a key/value record.
 *
 * Socket.io exposes the raw cookie string via `socket.handshake.headers.cookie`.
 * Unlike Express (which uses cookie-parser), Socket.io does not provide a
 * parsed `cookies` object, so we parse it manually here.
 *
 * Handles quoted values, URL-encoded values, and multiple cookies separated
 * by semicolons.
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const index = pair.indexOf('=');
    if (index === -1) continue;

    const key = pair.substring(0, index).trim();
    let value = pair.substring(index + 1).trim();

    // Remove surrounding double-quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    // URL-decode the value
    try {
      value = decodeURIComponent(value);
    } catch {
      // Keep raw value if decoding fails
    }

    cookies[key] = value;
  }

  return cookies;
}

// ============================================================================
// Cookie names (mirrors cookie-helper.ts for Socket.io context)
// ============================================================================

/**
 * Cookie names used for Layer-2 reconnection.
 * Must match the names used in `cookie-helper.ts`.
 */
const COOKIE_NAMES = {
  playerId: 'tc_player_id',
  roomCode: 'tc_room_code',
} as const;

// ============================================================================
// Auth middleware
// ============================================================================

/**
 * Socket.io middleware that runs on every new connection.
 *
 * Responsibilities:
 * 1. Parse cookies from the handshake HTTP headers.
 * 2. Extract the player ID and room code cookies (Layer-2 reconnect data)
 *    and attach them to `socket.data` for later use by reconnect handlers.
 * 3. Log the connection attempt with relevant metadata.
 * 4. Pass through to the next middleware — unauthenticated connections are
 *    allowed; specific event handlers (e.g. `room:join`) will enforce
 *    authentication as needed.
 *
 * This design allows a single socket to be used for:
 * - Initial join (no prior auth)
 * - Reconnection via localStorage token (Layer 1)
 * - Reconnection via HTTP-only cookie (Layer 2)
 * - Reconnection via fingerprint (Layer 3)
 * - Manual reconnection via name + seat (Layer 4)
 *
 * @param socket  The incoming socket.
 * @param next    Callback to continue the middleware chain.
 */
export function authMiddleware(
  socket: AppSocket,
  next: (err?: Error) => void,
): void {
  // 1. Parse cookies from the handshake headers
  const cookieHeader = socket.handshake.headers.cookie;
  const cookies = parseCookies(cookieHeader);

  // 2. Extract player ID and room code from cookies (Layer-2 data)
  const cookiePlayerId = cookies[COOKIE_NAMES.playerId];
  const cookieRoomCode = cookies[COOKIE_NAMES.roomCode];

  // Stash cookie identity separately. Setting playerId/roomCode here made a
  // never-joined socket look seated, so its disconnect marked the real
  // player offline (or raced a newer tab that already reconnected).
  if (cookiePlayerId) {
    socket.data.cookiePlayerId = cookiePlayerId;
  }
  if (cookieRoomCode) {
    socket.data.cookieRoomCode = cookieRoomCode;
  }

  // 3. Log the connection attempt
  logger.info('Socket connection attempt', {
    id: socket.id,
    transport: socket.handshake.query.transport ?? 'websocket',
    cookiePlayerId: cookiePlayerId ?? null,
    cookieRoomCode: cookieRoomCode ?? null,
  });

  // 4. Pass through — unauthenticated connections are handled by event handlers
  next();
}
