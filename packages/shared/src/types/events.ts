import type { StateSnapshot } from './game';
import type { GamePhase } from './phases';
import type { QueueEntry, QueueStatusUpdate } from './queue';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes returned via the `error` server-to-client event.
 * `SESSION_EXPIRED` is used when a reconnect token's gameSession does not
 * match the room's current gameSession (cross-game isolation).
 */
export const ErrorCodes = {
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  INVALID_ACTION: 'INVALID_ACTION',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  NUMBER_ALREADY_USED: 'NUMBER_ALREADY_USED',
  GEM_ALREADY_PICKED: 'GEM_ALREADY_PICKED',
  GEM_NOT_FOUND: 'GEM_NOT_FOUND',
  NOT_HOST: 'NOT_HOST',
  QUEUE_FULL: 'QUEUE_FULL',
  NAME_TAKEN: 'NAME_TAKEN',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// Client Role
// ============================================================================

/**
 * The role a client connects as when joining a room.
 * - `player`: A game participant using their phone
 * - `screen`: The big-screen display for spectators
 * - `host`: The host control panel
 */
export type ClientRole = 'player' | 'screen' | 'host';

// ============================================================================
// Client-to-Server Event Payloads
// ============================================================================

/** `room:join` - Player, screen, or host joins a room */
export interface RoomJoinPayload {
  roomCode: string;
  playerName: string;
  role: ClientRole;
  fingerprint?: string;
  /** Host token (required when role is `host`; also accepted via handshake.auth). */
  hostToken?: string;
}

/** Acknowledgement after `room:join` / reconnect events */
export interface RoomJoinAck {
  success: boolean;
  roomCode?: string;
  playerId?: string;
  authToken?: string;
  seatNumber?: number;
  hostToken?: string;
  queued?: boolean;
  queuePosition?: number;
  /**
   * Full role-filtered snapshot at join time.
   * Screen refresh applies this immediately so a missed `state:sync`
   * cannot leave the projector on an empty lobby.
   */
  snapshot?: StateSnapshot;
  error?: { code: string; message: string };
}

/** Acknowledgement after `host:create_room` */
export interface CreateRoomAck {
  success: boolean;
  roomCode?: string;
  hostToken?: string;
  error?: { code: ErrorCode; message: string };
}

/** `room:reconnect` - Layer 1 reconnect via localStorage token */
export interface RoomReconnectPayload {
  roomCode: string;
  playerId: string;
  authToken: string;
}

/** `room:reconnect_by_cookie` - Layer 2 reconnect via HTTP-only cookie */
export interface RoomReconnectByCookiePayload {
  roomCode: string;
}

/** `room:reconnect_by_fingerprint` - Layer 3 reconnect via browser fingerprint */
export interface RoomReconnectByFingerprintPayload {
  roomCode: string;
  fingerprint: string;
}

/** `room:reconnect_by_name` - Layer 4 manual reconnect via name + seat */
export interface RoomReconnectByNamePayload {
  roomCode: string;
  playerName: string;
  seatNumber: number;
}

/** `queue:join` - Join the waiting queue when room is full */
export interface QueueJoinPayload {
  roomCode: string;
  playerName: string;
  fingerprint?: string;
}

/** `action:submit_number` - Submit a number for the current round */
export interface SubmitNumberPayload {
  number: number;
}

/** `action:select_gem` - Pick a gem during GEM_SELECTION */
export interface SelectGemPayload {
  gemId: string;
}

/** `host:create_room` - Create a room with a target player count */
export interface CreateRoomPayload {
  hostName: string;
  targetPlayers: number;
  /** Password to authorise host actions (compared against HOST_PASSWORD env). */
  hostPassword: string;
}

/** `host:skip_player` - Skip the current picker (host override) */
export interface SkipPlayerPayload {
  playerId: string;
}

/** `host:promote_player` - Manually promote a queued player */
export interface PromotePlayerPayload {
  queueEntryId: string;
}

/** `host:remove_from_queue` - Remove a player from the waiting queue */
export interface RemoveFromQueuePayload {
  queueEntryId: string;
}

// ============================================================================
// Server-to-Client Event Payloads
// ============================================================================

/** `timer:tick` - Broadcast every second during active timers */
export interface TimerTickPayload {
  remaining: number;
  phase: GamePhase;
  currentPlayerId?: string;
}

/** `player:joined` - A new player joined the room */
export interface PlayerJoinedPayload {
  playerId: string;
  name: string;
  seatNumber: number;
}

/** `player:left` - A player left the room */
export interface PlayerLeftPayload {
  playerId: string;
}

/** `player:reconnected` - A player reconnected after disconnection */
export interface PlayerReconnectedPayload {
  playerId: string;
}

/** `queue:promoted` - A queued player was promoted to a full player */
export interface QueuePromotedPayload {
  playerId: string;
  authToken: string;
  seatNumber: number;
}

/** `queue:update` - Full queue list update (host only) */
export interface QueueUpdatePayload {
  queueList: QueueEntry[];
  totalInQueue: number;
}

/** `error` - Error notification */
export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

// ============================================================================
// Socket.io Event Maps
// ============================================================================

/**
 * All client-to-server Socket.io events.
 * Maps event names to their handler signatures with typed payloads.
 *
 * Events without payloads use `() => void`.
 */
export interface ClientToServerEvents {
  'room:join': (payload: RoomJoinPayload, callback?: (response: RoomJoinAck) => void) => void;
  'room:reconnect': (payload: RoomReconnectPayload, callback?: (response: RoomJoinAck) => void) => void;
  'room:reconnect_by_cookie': (
    payload: RoomReconnectByCookiePayload,
    callback?: (response: RoomJoinAck) => void,
  ) => void;
  'room:reconnect_by_fingerprint': (
    payload: RoomReconnectByFingerprintPayload,
    callback?: (response: RoomJoinAck) => void,
  ) => void;
  'room:reconnect_by_name': (
    payload: RoomReconnectByNamePayload,
    callback?: (response: RoomJoinAck) => void,
  ) => void;
  'room:leave': () => void;
  'queue:join': (payload: QueueJoinPayload) => void;
  'queue:leave': () => void;
  'action:submit_number': (payload: SubmitNumberPayload) => void;
  'action:select_gem': (payload: SelectGemPayload) => void;
  'host:create_room': (
    payload: CreateRoomPayload,
    callback?: (response: CreateRoomAck) => void,
  ) => void;
  'host:start_game': () => void;
  'host:pause': () => void;
  'host:resume': () => void;
  'host:advance_phase': () => void;
  'host:skip_player': (payload: SkipPlayerPayload) => void;
  'host:promote_player': (payload: PromotePlayerPayload) => void;
  'host:remove_from_queue': (payload: RemoveFromQueuePayload) => void;
  'host:end_game': () => void;
  'host:restart': () => void;
}

/**
 * All server-to-client Socket.io events.
 * Maps event names to their handler signatures with typed payloads.
 *
 * - `state:sync`: Full state snapshot (role-filtered) sent on every state change
 * - `timer:tick`: Per-second timer broadcast during NUMBER_SELECTION and GEM_SELECTION
 * - `player:joined`/`player:left`/`player:reconnected`: Player lifecycle notifications
 * - `queue:status`: Queue position update (queued players only)
 * - `queue:promoted`: Promotion notification when a queued player becomes a full player
 * - `queue:update`: Full queue list (host only)
 * - `error`: Error notification with code and message
 */
export interface ServerToClientEvents {
  'state:sync': (snapshot: StateSnapshot) => void;
  'timer:tick': (payload: TimerTickPayload) => void;
  'player:joined': (payload: PlayerJoinedPayload) => void;
  'player:left': (payload: PlayerLeftPayload) => void;
  'player:reconnected': (payload: PlayerReconnectedPayload) => void;
  'queue:status': (payload: QueueStatusUpdate) => void;
  'queue:promoted': (payload: QueuePromotedPayload) => void;
  'queue:update': (payload: QueueUpdatePayload) => void;
  'error': (payload: ErrorPayload) => void;
}
