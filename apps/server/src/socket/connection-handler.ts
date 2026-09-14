import type {
  RoomJoinPayload,
  RoomReconnectPayload,
  RoomReconnectByCookiePayload,
  RoomReconnectByFingerprintPayload,
  RoomReconnectByNamePayload,
  RoomJoinAck,
} from '@treasure-contest/shared';
import type { RoomManager } from '../game/room-manager.js';
import type { QueueManager } from '../game/queue-manager.js';
import type { Room } from '../game/room.js';
import type { Broadcaster } from './broadcaster.js';
import type { AppServer, AppSocket } from './middleware.js';
import { verifyAuthToken } from '../identity/auth-token.js';
import { compareFingerprints } from '../identity/fingerprint.js';
import * as playerRepo from '../db/repositories/player-repo.js';
import * as roomRepo from '../db/repositories/room-repo.js';
import { logger } from '../utils/logger.js';
import {
  QUEUE_CONFIG,
} from '@treasure-contest/shared';
import {
  decideLobbyJoin,
  findPlayerByName,
  normalizePlayerName,
  normalizeRoomCode,
} from '../game/lobby-join.js';

// ============================================================================
// Connection handler setup
// ============================================================================

/**
 * Register all connection-related event handlers on a socket.
 *
 * Handles:
 * - `room:join` — Player, screen, or host joining a room.
 * - `room:reconnect` — Layer 1: localStorage auth token.
 * - `room:reconnect_by_cookie` — Layer 2: HTTP-only cookie.
 * - `room:reconnect_by_fingerprint` — Layer 3: browser fingerprint.
 * - `room:reconnect_by_name` — Layer 4: manual name + seat recovery.
 * - `room:leave` — Player explicitly leaving (frees seat, may promote queue).
 * - `disconnect` — Socket disconnected (marks player disconnected, keeps data).
 *
 * @param io            The Socket.io server instance.
 * @param socket        The individual socket connection.
 * @param roomManager   The room manager singleton.
 * @param queueManager  The queue manager singleton.
 * @param broadcaster   The broadcaster for sending state to clients.
 */
export function setupConnectionHandlers(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  // -- room:join ----------------------------------------------------------
  socket.on(
    'room:join',
    ((
      payload: RoomJoinPayload,
      ack?: (response: RoomJoinAck) => void,
    ): void => {
      handleRoomJoin(io, socket, payload, ack, roomManager, queueManager, broadcaster);
    }) as (payload: RoomJoinPayload) => void,
  );

  // -- room:reconnect (Layer 1) -------------------------------------------
  socket.on(
    'room:reconnect',
    ((
      payload: RoomReconnectPayload,
      ack?: (response: RoomJoinAck) => void,
    ): void => {
      handleReconnectByToken(io, socket, payload, ack, roomManager, broadcaster);
    }) as (payload: RoomReconnectPayload) => void,
  );

  // -- room:reconnect_by_cookie (Layer 2) ---------------------------------
  socket.on(
    'room:reconnect_by_cookie',
    ((
      payload: RoomReconnectByCookiePayload,
      ack?: (response: RoomJoinAck) => void,
    ): void => {
      handleReconnectByCookie(io, socket, payload, ack, roomManager, broadcaster);
    }) as (payload: RoomReconnectByCookiePayload) => void,
  );

  // -- room:reconnect_by_fingerprint (Layer 3) ----------------------------
  socket.on(
    'room:reconnect_by_fingerprint',
    ((
      payload: RoomReconnectByFingerprintPayload,
      ack?: (response: RoomJoinAck) => void,
    ): void => {
      handleReconnectByFingerprint(io, socket, payload, ack, roomManager, broadcaster);
    }) as (payload: RoomReconnectByFingerprintPayload) => void,
  );

  // -- room:reconnect_by_name (Layer 4) -----------------------------------
  socket.on(
    'room:reconnect_by_name',
    ((
      payload: RoomReconnectByNamePayload,
      ack?: (response: RoomJoinAck) => void,
    ): void => {
      handleReconnectByName(io, socket, payload, ack, roomManager, broadcaster);
    }) as (payload: RoomReconnectByNamePayload) => void,
  );

  // -- room:leave ----------------------------------------------------------
  socket.on('room:leave', () => {
    handleRoomLeave(io, socket, roomManager, queueManager, broadcaster);
  });

  // -- disconnect ---------------------------------------------------------
  socket.on('disconnect', (reason: string) => {
    handleDisconnect(io, socket, reason, roomManager, queueManager, broadcaster);
  });
}

// ============================================================================
// room:join handler
// ============================================================================

/**
 * Handle a `room:join` event from a player, screen, or host.
 *
 * Player flow:
 * 1. If room is in LOBBY and has space → create player, assign seat, return
 *    auth token.
 * 2. If room is in LOBBY but full → add to waiting queue, return queue status.
 * 3. If room is NOT in LOBBY → check if the player name matches an existing
 *    player (simple reconnection); otherwise reject with GAME_ALREADY_STARTED.
 *
 * Screen flow:
 * - Set screenSocketId, join room, broadcast current state.
 *
 * Host flow:
 * - Verify host token from handshake auth, set hostSocketId, broadcast state.
 */
function handleRoomJoin(
  io: AppServer,
  socket: AppSocket,
  payload: RoomJoinPayload,
  ack: ((response: RoomJoinAck) => void) | undefined,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  const roomCode = normalizeRoomCode(payload.roomCode);
  const playerName = normalizePlayerName(payload.playerName ?? '');
  const { role, fingerprint, hostToken } = payload;

  logger.info('room:join', {
    socketId: socket.id,
    roomCode,
    playerName,
    role,
    hasFingerprint: fingerprint !== undefined,
    hasHostToken: Boolean(hostToken),
  });

  // Verify the room exists
  const room = roomManager.getRoom(roomCode);
  if (!room) {
    const error = { code: 'ROOM_NOT_FOUND' as const, message: `Room ${roomCode} not found` };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  switch (role) {
    case 'player':
      handlePlayerJoin(io, socket, room, playerName, fingerprint, ack, roomManager, queueManager, broadcaster);
      break;

    case 'screen':
      handleScreenJoin(io, socket, room, broadcaster);
      if (ack) ack({ success: true, roomCode });
      break;

    case 'host': {
      const joined = handleHostJoin(io, socket, room, playerName, hostToken, broadcaster);
      if (ack) {
        if (joined) {
          ack({ success: true, roomCode: room.code, hostToken: socket.data.hostToken });
        } else {
          ack({
            success: false,
            error: { code: 'NOT_HOST', message: 'Invalid host token' },
          });
        }
      }
      break;
    }

    default:
      broadcaster.sendError(socket, 'INVALID_ACTION', `Unknown role: ${role}`);
      if (ack) ack({ success: false, error: { code: 'INVALID_ACTION', message: `Unknown role: ${role}` } });
  }
}

/**
 * Handle a player joining a room.
 */
function handlePlayerJoin(
  io: AppServer,
  socket: AppSocket,
  room: Room,
  playerName: string,
  fingerprint: string | undefined,
  ack: ((response: RoomJoinAck) => void) | undefined,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  // Case 1: Room is in LOBBY — new join, reclaim disconnected seat, or queue
  if (room.phase === 'LOBBY') {
    const decision = decideLobbyJoin({
      players: room.players.values(),
      playerName,
      targetPlayers: room.targetPlayers,
      queueLength: room.queue.length,
    });

    if (decision.action === 'reconnect') {
      attachReconnectedPlayer(
        io,
        socket,
        room,
        decision.playerId,
        fingerprint,
        ack,
        roomManager,
        queueManager,
        broadcaster,
        'lobby same-name reclaim',
      );
      return;
    }

    if (decision.action === 'name_taken') {
      const errorCode = 'NAME_TAKEN';
      const errorMsg = `Name "${playerName}" is already taken`;
      broadcaster.sendError(socket, errorCode, errorMsg);
      if (ack) ack({ success: false, error: { code: errorCode, message: errorMsg } });
      return;
    }

    if (decision.action === 'join_new') {
      const result = roomManager.addPlayerToRoom(
        room.code,
        playerName,
        socket.id,
        fingerprint,
      );

      if (!result) {
        const errorCode = 'ROOM_FULL';
        const errorMsg = 'Room is full';
        broadcaster.sendError(socket, errorCode, errorMsg);
        if (ack) ack({ success: false, error: { code: errorCode, message: errorMsg } });
        return;
      }

      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.role = 'player';
      socket.data.playerId = result.player.id;
      if (fingerprint) {
        socket.data.fingerprint = fingerprint;
      }

      io.to(room.code).emit('player:joined', {
        playerId: result.player.id,
        name: result.player.name,
        seatNumber: result.player.seatNumber,
      });

      broadcaster.broadcast(room);

      logger.info('Player joined room', {
        room: room.code,
        playerId: result.player.id,
        name: result.player.name,
        seat: result.player.seatNumber,
      });

      if (ack) {
        ack({
          success: true,
          roomCode: room.code,
          playerId: result.player.id,
          authToken: result.authToken,
          seatNumber: result.player.seatNumber,
        });
      }
      return;
    }

    if (decision.action === 'queue_full') {
      const errorCode = 'QUEUE_FULL';
      const errorMsg = 'Waiting queue is full';
      broadcaster.sendError(socket, errorCode, errorMsg);
      if (ack) ack({ success: false, error: { code: errorCode, message: errorMsg } });
      return;
    }

    // Room is at target capacity — add (or refresh) a waiting-queue entry
    if (room.queue.length >= QUEUE_CONFIG.MAX_QUEUE_SIZE && decision.action === 'queue') {
      const alreadyQueued = room.queue.some(
        (e) => normalizePlayerName(e.playerName) === playerName,
      );
      if (!alreadyQueued) {
        const errorCode = 'QUEUE_FULL';
        const errorMsg = 'Waiting queue is full';
        broadcaster.sendError(socket, errorCode, errorMsg);
        if (ack) ack({ success: false, error: { code: errorCode, message: errorMsg } });
        return;
      }
    }

    const entry = queueManager.addToQueue(
      room,
      playerName,
      socket.id,
      fingerprint,
    );

    if (!entry) {
      const errorCode = 'QUEUE_FULL';
      const errorMsg = 'Failed to join queue';
      broadcaster.sendError(socket, errorCode, errorMsg);
      if (ack) ack({ success: false, error: { code: errorCode, message: errorMsg } });
      return;
    }

    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.role = 'queued';
    socket.data.queueEntryId = entry.id;
    if (fingerprint) {
      socket.data.fingerprint = fingerprint;
    }

    const estimatedWait = `${Math.ceil(entry.position * 5)} minutes`;
    socket.emit('queue:status', {
      position: entry.position,
      totalInQueue: room.queue.length,
      estimatedWait,
    });

    broadcaster.sendQueueUpdate(room, room.queue);
    broadcaster.broadcast(room);

    logger.info('Player added to queue', {
      room: room.code,
      playerName,
      position: entry.position,
    });

    if (ack) {
      ack({
        success: true,
        roomCode: room.code,
        queued: true,
        queuePosition: entry.position,
      });
    }
    return;
  }

  // Case 2: Room is NOT in LOBBY — check for reconnection by name
  const existingPlayer = findPlayerByName(room.players.values(), playerName);

  if (existingPlayer) {
    // Reconnect the player
    const reconnected = roomManager.reconnectPlayer(
      room.code,
      existingPlayer.id,
      socket.id,
    );

    if (!reconnected) {
      const errorCode = 'PLAYER_NOT_FOUND';
      const errorMsg = 'Player not found in room';
      broadcaster.sendError(socket, errorCode, errorMsg);
      if (ack) ack({ success: false, error: { code: errorCode, message: errorMsg } });
      return;
    }

    // Set socket data
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.role = 'player';
    socket.data.playerId = existingPlayer.id;
    if (fingerprint) {
      socket.data.fingerprint = fingerprint;
    }

    // Notify the room
    io.to(room.code).emit('player:reconnected', { playerId: existingPlayer.id });

    // Broadcast updated state
    broadcaster.broadcast(room);

    logger.info('Player reconnected via room:join (name match)', {
      room: room.code,
      playerId: existingPlayer.id,
      name: existingPlayer.name,
    });

    if (ack) {
      ack({
        success: true,
        roomCode: room.code,
        playerId: existingPlayer.id,
        authToken: lookupPlayerAuthToken(existingPlayer.id),
        seatNumber: existingPlayer.seatNumber,
      });
    }
    return;
  }

  // Player not found and game already started
  const errorCode = 'GAME_ALREADY_STARTED';
  const errorMsg = 'Game has already started. Use a reconnection method.';
  broadcaster.sendError(socket, errorCode, errorMsg);
  if (ack) ack({ success: false, error: { code: errorCode, message: errorMsg } });
}

/**
 * Handle a screen (big-screen display) joining a room.
 */
function handleScreenJoin(
  _io: AppServer,
  socket: AppSocket,
  room: Room,
  broadcaster: Broadcaster,
): void {
  // A later screen tab replaces the previous one. Do not require a
  // particular phase — GAME_OVER / post-restart LOBBY must still attach.
  room.screenSocketId = socket.id;

  // Update DB
  try {
    roomRepo.updateRoom(room.code, { screenId: socket.id });
  } catch (err) {
    logger.error('Failed to update screen socket ID in DB', { error: err });
  }

  // Set socket data
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.role = 'screen';

  // Broadcast current state to all (screen gets ScreenSnapshot)
  broadcaster.broadcast(room);

  logger.info('Screen joined room', {
    room: room.code,
    socketId: socket.id,
    phase: room.phase,
    players: room.players.size,
    session: room.gameSession,
  });
}

/**
 * Handle a host joining (or reconnecting to) a room.
 *
 * The host token is read from `socket.handshake.auth.hostToken`, which the
 * client provides during the Socket.io connection handshake.
 */
function handleHostJoin(
  _io: AppServer,
  socket: AppSocket,
  room: Room,
  hostName: string,
  payloadHostToken: string | undefined,
  broadcaster: Broadcaster,
): boolean {
  // Token may arrive in the join payload (refresh / reconnect) or in
  // handshake.auth (set before socket.connect). Either is sufficient.
  const handshakeAuth = socket.handshake.auth as { hostToken?: string } | undefined;
  const hostToken = payloadHostToken || handshakeAuth?.hostToken;

  if (!hostToken || hostToken !== room.hostToken) {
    broadcaster.sendError(socket, 'NOT_HOST', 'Invalid host token');
    logger.warn('Host join rejected: invalid token', {
      room: room.code,
      socketId: socket.id,
      hasPayloadToken: Boolean(payloadHostToken),
      hasHandshakeToken: Boolean(handshakeAuth?.hostToken),
    });
    return false;
  }

  // Name is informational. A valid host token is sufficient to reclaim
  // the console after refresh; a mismatched leftover name must not block it.
  if (hostName && hostName !== room.hostName) {
    logger.info('Host join name differs from room hostName; accepting token', {
      room: room.code,
      provided: hostName,
      expected: room.hostName,
    });
  }

  // Set the host socket ID on the room
  room.hostSocketId = socket.id;

  // Update DB
  try {
    roomRepo.updateRoom(room.code, { hostId: socket.id });
  } catch (err) {
    logger.error('Failed to update host socket ID in DB', { error: err });
  }

  // Set socket data
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.role = 'host';
  socket.data.hostToken = hostToken;

  // Broadcast current state (host gets HostSnapshot)
  broadcaster.broadcast(room);

  logger.info('Host joined room', {
    room: room.code,
    socketId: socket.id,
    hostName: hostName || room.hostName,
  });
  return true;
}

// ============================================================================
// Layer 1: room:reconnect (localStorage auth token)
// ============================================================================

/**
 * Handle Layer 1 reconnection via localStorage auth token.
 *
 * The client sends `{ roomCode, playerId, authToken }`. The server verifies:
 * 1. The auth token is well-formed.
 * 2. The embedded gameSession matches the room's current gameSession.
 * 3. The playerId and roomCode embedded in the token match the payload.
 *
 * On success: updates the socket ID, marks the player as connected, and
 * broadcasts the updated state.
 * On session mismatch: sends `SESSION_EXPIRED`.
 */
function handleReconnectByToken(
  io: AppServer,
  socket: AppSocket,
  payload: RoomReconnectPayload,
  ack: ((response: RoomJoinAck) => void) | undefined,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const { roomCode, playerId, authToken } = payload;

  logger.info('room:reconnect (Layer 1: token)', {
    socketId: socket.id,
    roomCode,
    playerId,
  });

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    const error = { code: 'ROOM_NOT_FOUND' as const, message: `Room ${roomCode} not found` };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Verify the auth token
  const verification = verifyAuthToken(authToken, room.gameSession);
  if (!verification.valid) {
    // Check if the failure was due to session mismatch
    if (verification.session !== undefined && verification.session !== room.gameSession) {
      const error = {
        code: 'SESSION_EXPIRED' as const,
        message: 'Game session has expired. Please rejoin the room.',
      };
      broadcaster.sendError(socket, error.code, error.message);
      if (ack) ack({ success: false, error });
      return;
    }

    // Generic token verification failure
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: 'Invalid auth token',
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Verify playerId and roomCode match
  if (verification.playerId !== playerId || verification.roomCode !== roomCode) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: 'Token does not match provided player ID or room code',
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Check if the player exists in the room
  if (!room.players.has(playerId)) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: 'Player not found in this room',
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Reconnect the player
  const player = roomManager.reconnectPlayer(roomCode, playerId, socket.id);
  if (!player) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: 'Failed to reconnect player',
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Set socket data
  socket.join(roomCode);
  socket.data.roomCode = roomCode;
  socket.data.role = 'player';
  socket.data.playerId = playerId;

  // Notify the room
  io.to(roomCode).emit('player:reconnected', { playerId });

  // Broadcast updated state
  broadcaster.broadcast(room);

  logger.info('Player reconnected (Layer 1: token)', {
    room: roomCode,
    playerId,
    name: player.name,
  });

  if (ack) {
    ack({
      success: true,
      roomCode,
      playerId,
      authToken: lookupPlayerAuthToken(playerId),
      seatNumber: player.seatNumber,
    });
  }
}

// ============================================================================
// Layer 2: room:reconnect_by_cookie (HTTP-only cookie)
// ============================================================================

/**
 * Handle Layer 2 reconnection via HTTP-only cookie.
 *
 * The middleware already parsed the cookies and stored `playerId` and
 * `roomCode` in `socket.data`. This handler verifies that the player exists
 * in the room and reconnects them.
 *
 * The payload only contains `{ roomCode }` — the player ID comes from the
 * cookie that was set during a previous session.
 */
function handleReconnectByCookie(
  io: AppServer,
  socket: AppSocket,
  payload: RoomReconnectByCookiePayload,
  ack: ((response: RoomJoinAck) => void) | undefined,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const { roomCode } = payload;
  // Player ID comes from the cookie (set by middleware)
  const cookiePlayerId = socket.data.playerId;

  logger.info('room:reconnect_by_cookie (Layer 2: cookie)', {
    socketId: socket.id,
    roomCode,
    cookiePlayerId: cookiePlayerId ?? null,
  });

  if (!cookiePlayerId) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: 'No player cookie found. Please rejoin the room.',
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    const error = { code: 'ROOM_NOT_FOUND' as const, message: `Room ${roomCode} not found` };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Check if the player exists in the room
  if (!room.players.has(cookiePlayerId)) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: 'Player not found in this room (cookie may be from a previous session)',
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Reconnect the player
  const player = roomManager.reconnectPlayer(roomCode, cookiePlayerId, socket.id);
  if (!player) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: 'Failed to reconnect player',
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Set socket data
  socket.join(roomCode);
  socket.data.roomCode = roomCode;
  socket.data.role = 'player';
  socket.data.playerId = cookiePlayerId;

  // Notify the room
  io.to(roomCode).emit('player:reconnected', { playerId: cookiePlayerId });

  // Broadcast updated state
  broadcaster.broadcast(room);

  logger.info('Player reconnected (Layer 2: cookie)', {
    room: roomCode,
    playerId: cookiePlayerId,
    name: player.name,
  });

  if (ack) {
    ack({
      success: true,
      roomCode,
      playerId: cookiePlayerId,
      authToken: lookupPlayerAuthToken(cookiePlayerId),
      seatNumber: player.seatNumber,
    });
  }
}

// ============================================================================
// Layer 3: room:reconnect_by_fingerprint (browser fingerprint)
// ============================================================================

/**
 * Handle Layer 3 reconnection via browser fingerprint.
 *
 * The client sends `{ roomCode, fingerprint }`. The server queries all player
 * records in the room from the DB and uses fuzzy fingerprint comparison
 * (`compareFingerprints`) to find a match.
 *
 * On success: reconnects the player and broadcasts state.
 * On failure: sends `PLAYER_NOT_FOUND`.
 */
function handleReconnectByFingerprint(
  io: AppServer,
  socket: AppSocket,
  payload: RoomReconnectByFingerprintPayload,
  ack: ((response: RoomJoinAck) => void) | undefined,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const { roomCode, fingerprint } = payload;

  logger.info('room:reconnect_by_fingerprint (Layer 3: fingerprint)', {
    socketId: socket.id,
    roomCode,
  });

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    const error = { code: 'ROOM_NOT_FOUND' as const, message: `Room ${roomCode} not found` };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Query all players in the room from DB to get their stored fingerprints
  let dbPlayers: playerRepo.PlayerRecord[] = [];
  try {
    dbPlayers = playerRepo.getPlayersByRoom(roomCode);
  } catch (err) {
    logger.error('Failed to query players from DB for fingerprint reconnect', { error: err });
  }

  // Try to find a matching player by fingerprint
  let matchedPlayerId: string | null = null;

  for (const dbPlayer of dbPlayers) {
    if (compareFingerprints(dbPlayer.browserFingerprint, fingerprint)) {
      // Verify the player exists in the in-memory room
      if (room.players.has(dbPlayer.id)) {
        matchedPlayerId = dbPlayer.id;
        break;
      }
    }
  }

  if (!matchedPlayerId) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: 'No player found matching this fingerprint',
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Reconnect the player
  const player = roomManager.reconnectPlayer(roomCode, matchedPlayerId, socket.id);
  if (!player) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: 'Failed to reconnect player',
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Set socket data
  socket.join(roomCode);
  socket.data.roomCode = roomCode;
  socket.data.role = 'player';
  socket.data.playerId = matchedPlayerId;
  socket.data.fingerprint = fingerprint;

  // Notify the room
  io.to(roomCode).emit('player:reconnected', { playerId: matchedPlayerId });

  // Broadcast updated state
  broadcaster.broadcast(room);

  logger.info('Player reconnected (Layer 3: fingerprint)', {
    room: roomCode,
    playerId: matchedPlayerId,
    name: player.name,
  });

  if (ack) {
    ack({
      success: true,
      roomCode,
      playerId: matchedPlayerId,
      authToken: lookupPlayerAuthToken(matchedPlayerId),
      seatNumber: player.seatNumber,
    });
  }
}

// ============================================================================
// Layer 4: room:reconnect_by_name (manual: name + seat)
// ============================================================================

/**
 * Handle Layer 4 manual reconnection via name + seat number.
 *
 * The client sends `{ roomCode, playerName, seatNumber }`. The server finds
 * the player in the in-memory room by seat number and verifies the name
 * matches.
 *
 * This is the fallback layer used when all automatic methods fail (e.g.,
 * the player is on a different device, localStorage is cleared, and no
 * cookie is present).
 */
function handleReconnectByName(
  io: AppServer,
  socket: AppSocket,
  payload: RoomReconnectByNamePayload,
  ack: ((response: RoomJoinAck) => void) | undefined,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const { roomCode, playerName, seatNumber } = payload;

  logger.info('room:reconnect_by_name (Layer 4: name + seat)', {
    socketId: socket.id,
    roomCode,
    playerName,
    seatNumber,
  });

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    const error = { code: 'ROOM_NOT_FOUND' as const, message: `Room ${roomCode} not found` };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Find the player by seat number
  const player = room.getPlayerBySeat(seatNumber);
  if (!player) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: `No player at seat ${seatNumber}`,
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Verify the name matches
  if (player.name !== playerName) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: `Name "${playerName}" does not match seat ${seatNumber} (${player.name})`,
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Reconnect the player
  const reconnected = roomManager.reconnectPlayer(roomCode, player.id, socket.id);
  if (!reconnected) {
    const error = {
      code: 'PLAYER_NOT_FOUND' as const,
      message: 'Failed to reconnect player',
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Set socket data
  socket.join(roomCode);
  socket.data.roomCode = roomCode;
  socket.data.role = 'player';
  socket.data.playerId = player.id;

  // Notify the room
  io.to(roomCode).emit('player:reconnected', { playerId: player.id });

  // Broadcast updated state
  broadcaster.broadcast(room);

  logger.info('Player reconnected (Layer 4: name + seat)', {
    room: roomCode,
    playerId: player.id,
    name: player.name,
    seatNumber,
  });

  if (ack) {
    ack({
      success: true,
      roomCode,
      playerId: player.id,
      authToken: lookupPlayerAuthToken(player.id),
      seatNumber: player.seatNumber,
    });
  }
}

// ============================================================================
// room:leave handler
// ============================================================================

/**
 * Handle a `room:leave` event — a player, screen, or host explicitly leaving.
 *
 * Unlike `disconnect`, `room:leave` is a permanent departure:
 * - Players are removed from the in-memory room (freeing their seat).
 * - The room state is broadcast to reflect the departure.
 * - If in LOBBY phase and there are queue players, the next queue player is
 *   promoted to fill the vacant seat.
 */
function handleRoomLeave(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  const roomCode = socket.data.roomCode;
  const role = socket.data.role;
  const playerId = socket.data.playerId;

  if (!roomCode) {
    logger.warn('room:leave called but no roomCode on socket', { socketId: socket.id });
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    logger.warn('room:leave: room not found', { socketId: socket.id, roomCode });
    socket.leave(roomCode);
    clearSocketData(socket);
    return;
  }

  logger.info('room:leave', {
    socketId: socket.id,
    roomCode,
    role,
    playerId: playerId ?? null,
  });

  // Handle based on role
  if (role === 'player' && playerId) {
    // Remove the player from the room
    room.players.delete(playerId);

    // Mark as disconnected in DB
    try {
      playerRepo.updatePlayerConnection(playerId, false);
      playerRepo.updatePlayerSocket(playerId, null);
    } catch (err) {
      logger.error('Failed to update player on leave', { error: err });
    }

    // Notify the room
    io.to(roomCode).emit('player:left', { playerId });

    // Broadcast updated state
    broadcaster.broadcast(room);

    // If in LOBBY, try to promote a queue player
    if (room.phase === 'LOBBY') {
      tryPromoteFromQueue(io, room, roomManager, queueManager, broadcaster);
    }
  } else if (role === 'screen') {
    // Clear the screen socket ID
    if (room.screenSocketId === socket.id) {
      room.screenSocketId = null;
      try {
        roomRepo.updateRoom(roomCode, { screenId: null });
      } catch (err) {
        logger.error('Failed to clear screen ID in DB', { error: err });
      }
    }
    broadcaster.broadcast(room);
  } else if (role === 'host') {
    // Clear the host socket ID
    if (room.hostSocketId === socket.id) {
      room.hostSocketId = null;
      try {
        roomRepo.updateRoom(roomCode, { hostId: null });
      } catch (err) {
        logger.error('Failed to clear host ID in DB', { error: err });
      }
    }
    broadcaster.broadcast(room);
  } else if (role === 'queued') {
    // Remove from queue
    const queueEntryId = socket.data.queueEntryId;
    if (queueEntryId) {
      queueManager.removeFromQueue(room, queueEntryId);
    }
    broadcaster.sendQueueUpdate(room, room.queue);
    broadcaster.broadcast(room);
  }

  // Leave the Socket.io room
  socket.leave(roomCode);
  clearSocketData(socket);
}

// ============================================================================
// disconnect handler
// ============================================================================

/**
 * Handle a socket `disconnect` event.
 *
 * Key behaviour:
 * - **Players**: Marked as `is_connected = false` but NOT removed from the
 *   room. They can reconnect later using any of the 4 reconnection layers.
 *   The state is broadcast so other clients see the player as disconnected.
 * - **Host**: `hostSocketId` is cleared so the host can reconnect.
 * - **Screen**: `screenSocketId` is cleared.
 * - **Queued**: Removed from the waiting queue (queue entries are ephemeral).
 */
function handleDisconnect(
  io: AppServer,
  socket: AppSocket,
  reason: string,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  const roomCode = socket.data.roomCode;
  const role = socket.data.role;
  const playerId = socket.data.playerId;

  logger.info('Socket disconnected', {
    socketId: socket.id,
    reason,
    roomCode: roomCode ?? null,
    role: role ?? null,
    playerId: playerId ?? null,
  });

  if (!roomCode) {
    // Socket was never associated with a room
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    return;
  }

  if (role === 'player' && playerId) {
    // Mark the player as disconnected (do NOT remove from room)
    roomManager.disconnectPlayer(roomCode, playerId);

    // Broadcast updated state
    broadcaster.broadcast(room);

    logger.info('Player marked as disconnected', {
      room: roomCode,
      playerId,
    });

    // If in LOBBY phase, may trigger queue promotion.
    // The disconnected player still occupies their seat, so we only
    // auto-promote if there is space below targetPlayers.
    if (room.phase === 'LOBBY' && room.players.size < room.targetPlayers) {
      tryPromoteFromQueue(io, room, roomManager, queueManager, broadcaster);
    }
  } else if (role === 'host') {
    // Clear the host socket ID
    if (room.hostSocketId === socket.id) {
      room.hostSocketId = null;
      try {
        roomRepo.updateRoom(roomCode, { hostId: null });
      } catch (err) {
        logger.error('Failed to clear host ID on disconnect', { error: err });
      }
    }
    broadcaster.broadcast(room);
    logger.info('Host socket disconnected', { room: roomCode });
  } else if (role === 'screen') {
    // Clear the screen socket ID
    if (room.screenSocketId === socket.id) {
      room.screenSocketId = null;
      try {
        roomRepo.updateRoom(roomCode, { screenId: null });
      } catch (err) {
        logger.error('Failed to clear screen ID on disconnect', { error: err });
      }
    }
    broadcaster.broadcast(room);
    logger.info('Screen socket disconnected', { room: roomCode });
  } else if (role === 'queued') {
    // Remove from queue (queue entries are ephemeral)
    const queueEntryId = socket.data.queueEntryId;
    if (queueEntryId) {
      queueManager.removeFromQueue(room, queueEntryId);
    }
    broadcaster.sendQueueUpdate(room, room.queue);
    broadcaster.broadcast(room);
    logger.info('Queued player disconnected and removed from queue', {
      room: roomCode,
      queueEntryId: queueEntryId ?? null,
    });
  }
}

// ============================================================================
// Helper: promote from queue
// ============================================================================

/**
 * Attempt to promote the next queued player to a full player seat.
 *
 * Called when:
 * - A player leaves during LOBBY (frees a seat).
 * - A player disconnects during LOBBY and there is space below targetPlayers.
 *
 * The promoted player's socket is updated from `queued` → `player` role,
 * a new player record is created, and `queue:promoted` is sent to the
 * promoted player. The room is notified via `player:joined`.
 */
function tryPromoteFromQueue(
  io: AppServer,
  room: Room,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  // Only promote during LOBBY when there is space
  if (room.phase !== 'LOBBY') return;
  if (room.players.size >= room.targetPlayers) return;
  if (room.queue.length === 0) return;

  // Promote the next queue entry
  const entry = queueManager.promoteNext(room);
  if (!entry) return;

  // The queue entry may have a stale socket ID if the player disconnected
  if (!entry.socketId) {
    logger.warn('Promoted queue entry has no socket ID, skipping', {
      room: room.code,
      queueEntryId: entry.id,
    });
    return;
  }

  // Create a new player from the queue entry
  const result = roomManager.addPlayerToRoom(
    room.code,
    entry.playerName,
    entry.socketId,
    entry.browserFingerprint,
  );

  if (!result) {
    // Could not add (name taken or room full) — re-add to front of queue?
    // For simplicity, log and let the host handle it.
    logger.warn('Failed to promote queue player to full player', {
      room: room.code,
      playerName: entry.playerName,
    });
    return;
  }

  // Update the promoted player's socket data
  const promotedSocket = io.sockets.sockets.get(entry.socketId);
  if (promotedSocket) {
    promotedSocket.data.role = 'player';
    promotedSocket.data.playerId = result.player.id;
    promotedSocket.data.queueEntryId = undefined;
    if (entry.browserFingerprint) {
      promotedSocket.data.fingerprint = entry.browserFingerprint;
    }
  }

  // Notify the promoted player
  io.to(entry.socketId).emit('queue:promoted', {
    playerId: result.player.id,
    authToken: result.authToken,
    seatNumber: result.player.seatNumber,
  });

  // Notify the room
  io.to(room.code).emit('player:joined', {
    playerId: result.player.id,
    name: result.player.name,
    seatNumber: result.player.seatNumber,
  });

  // Broadcast updated state
  broadcaster.broadcast(room);

  // Notify host of queue update
  broadcaster.sendQueueUpdate(room, room.queue);

  logger.info('Queue player promoted to full player', {
    room: room.code,
    playerId: result.player.id,
    name: result.player.name,
    seat: result.player.seatNumber,
  });

  // Recursively try to promote more if there is still space
  tryPromoteFromQueue(io, room, roomManager, queueManager, broadcaster);
}

// ============================================================================
// Helper: clear socket data
// ============================================================================

/**
 * Reset all role/room data on a socket after leaving.
 */
function lookupPlayerAuthToken(playerId: string): string | undefined {
  try {
    return playerRepo.getPlayer(playerId)?.authToken;
  } catch {
    return undefined;
  }
}

/**
 * Reconnect a seated player, drop a same-name queue leftover, and ack.
 */
function attachReconnectedPlayer(
  io: AppServer,
  socket: AppSocket,
  room: Room,
  playerId: string,
  fingerprint: string | undefined,
  ack: ((response: RoomJoinAck) => void) | undefined,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
  via: string,
): void {
  const player = room.players.get(playerId);
  if (!player) {
    const error = { code: 'PLAYER_NOT_FOUND' as const, message: 'Player not found in room' };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  const reconnected = roomManager.reconnectPlayer(room.code, playerId, socket.id);
  if (!reconnected) {
    const error = { code: 'PLAYER_NOT_FOUND' as const, message: 'Failed to reconnect player' };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  const leftoverQueue = room.queue.find(
    (e) => normalizePlayerName(e.playerName) === normalizePlayerName(player.name),
  );
  if (leftoverQueue) {
    queueManager.removeFromQueue(room, leftoverQueue.id);
  }

  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.role = 'player';
  socket.data.playerId = playerId;
  if (fingerprint) {
    socket.data.fingerprint = fingerprint;
  }

  io.to(room.code).emit('player:reconnected', { playerId });
  broadcaster.broadcast(room);

  logger.info('Player reconnected via room:join', {
    room: room.code,
    playerId,
    name: player.name,
    via,
  });

  if (ack) {
    ack({
      success: true,
      roomCode: room.code,
      playerId,
      authToken: lookupPlayerAuthToken(playerId),
      seatNumber: player.seatNumber,
    });
  }
}

function clearSocketData(socket: AppSocket): void {
  socket.data.roomCode = undefined;
  socket.data.role = undefined;
  socket.data.playerId = undefined;
  socket.data.hostToken = undefined;
  socket.data.fingerprint = undefined;
  socket.data.queueEntryId = undefined;
}
