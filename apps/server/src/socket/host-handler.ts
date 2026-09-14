import type {
  CreateRoomPayload,
  SkipPlayerPayload,
  PromotePlayerPayload,
  RemoveFromQueuePayload,
  ErrorCode,
} from '@treasure-contest/shared';
import {
  ErrorCodes,
  MIN_PLAYERS,
  MAX_PLAYERS,
  DEFAULT_TARGET_PLAYERS,
} from '@treasure-contest/shared';
import type { RoomManager } from '../game/room-manager.js';
import type { QueueManager } from '../game/queue-manager.js';
import type { Room } from '../game/room.js';
import type { Broadcaster } from './broadcaster.js';
import type { AppServer, AppSocket } from './middleware.js';
import crypto from 'node:crypto';
import { config } from '../config.js';
import * as roomRepo from '../db/repositories/room-repo.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Acknowledgement response type for host:create_room
// ============================================================================

/**
 * Response sent back to the host client via the Socket.io acknowledgement
 * callback after a `host:create_room` event. Contains the room code and
 * host token that the host client needs to store for future requests.
 */
interface CreateRoomAck {
  success: boolean;
  roomCode?: string;
  hostToken?: string;
  error?: { code: ErrorCode; message: string };
}

// ============================================================================
// Host handler setup
// ============================================================================

/**
 * Register all host-control event handlers on a socket.
 *
 * Handles:
 * - `host:create_room` — Create a new room (returns room code + host token).
 * - `host:start_game` — Start the game (LOBBY → first round).
 * - `host:pause` / `host:resume` — Pause/resume the game.
 * - `host:advance_phase` — Manually advance to the next phase.
 * - `host:skip_player` — Skip the current gem picker.
 * - `host:promote_player` — Promote a queued player to a full seat.
 * - `host:remove_from_queue` — Remove a player from the waiting queue.
 * - `host:end_game` — End the game early (→ GAME_OVER).
 * - `host:restart` — Restart for a new game (increments gameSession).
 *
 * All host actions (except `create_room`) verify that the socket is
 * authorised as the host of the room by checking `socket.data.role` and
 * `socket.data.roomCode`.
 *
 * @param io            The Socket.io server instance.
 * @param socket        The individual socket connection.
 * @param roomManager   The room manager singleton.
 * @param queueManager  The queue manager singleton.
 * @param broadcaster   The broadcaster for sending state to clients.
 */
export function setupHostHandlers(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  // -- host:create_room ---------------------------------------------------
  socket.on(
    'host:create_room',
    ((
      payload: CreateRoomPayload,
      ack?: (response: CreateRoomAck) => void,
    ): void => {
      handleCreateRoom(io, socket, payload, ack, roomManager, broadcaster);
    }) as (payload: CreateRoomPayload) => void,
  );

  // -- host:start_game ----------------------------------------------------
  socket.on('host:start_game', () => {
    handleStartGame(socket, roomManager, broadcaster);
  });

  // -- host:pause ---------------------------------------------------------
  socket.on('host:pause', () => {
    handlePause(socket, roomManager, broadcaster);
  });

  // -- host:resume --------------------------------------------------------
  socket.on('host:resume', () => {
    handleResume(socket, roomManager, broadcaster);
  });

  // -- host:advance_phase -------------------------------------------------
  socket.on('host:advance_phase', () => {
    handleAdvancePhase(socket, roomManager, broadcaster);
  });

  // -- host:skip_player ---------------------------------------------------
  socket.on('host:skip_player', (payload: SkipPlayerPayload) => {
    handleSkipPlayer(socket, payload, roomManager, broadcaster);
  });

  // -- host:promote_player ------------------------------------------------
  socket.on('host:promote_player', (payload: PromotePlayerPayload) => {
    handlePromotePlayer(io, socket, payload, roomManager, queueManager, broadcaster);
  });

  // -- host:remove_from_queue ---------------------------------------------
  socket.on('host:remove_from_queue', (payload: RemoveFromQueuePayload) => {
    handleRemoveFromQueue(io, socket, payload, roomManager, queueManager, broadcaster);
  });

  // -- host:end_game ------------------------------------------------------
  socket.on('host:end_game', () => {
    handleEndGame(socket, roomManager, broadcaster);
  });

  // -- host:restart -------------------------------------------------------
  socket.on('host:restart', () => {
    handleRestart(socket, roomManager, broadcaster);
  });
}

// ============================================================================
// Helper: verify host identity
// ============================================================================

/**
 * Verify that the socket is authorised as the host of a room.
 *
 * Checks:
 * 1. `socket.data.role` is `'host'`.
 * 2. `socket.data.roomCode` is set.
 * 3. The room exists and the socket's ID matches `room.hostSocketId`.
 *
 * @returns The room if authorised, or `null` (and sends an error to the socket).
 */
function verifyHost(
  socket: AppSocket,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): Room | null {
  if (socket.data.role !== 'host') {
    broadcaster.sendError(socket, 'NOT_HOST', 'You are not authorised as a host');
    return null;
  }

  const roomCode = socket.data.roomCode;
  if (!roomCode) {
    broadcaster.sendError(socket, 'NOT_HOST', 'No room associated with this connection');
    return null;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    broadcaster.sendError(socket, 'ROOM_NOT_FOUND', `Room ${roomCode} not found`);
    return null;
  }

  // Verify the socket is the current host
  if (room.hostSocketId !== socket.id) {
    broadcaster.sendError(socket, 'NOT_HOST', 'Another host is currently connected');
    return null;
  }

  return room;
}

// ============================================================================
// host:create_room
// ============================================================================

/**
 * Handle `host:create_room` — create a new room.
 *
 * Flow:
 * 1. Validate `targetPlayers` (between MIN_PLAYERS and MAX_PLAYERS).
 * 2. Call `roomManager.createRoom()` which generates a unique room code,
 *    host token, and persists the room to the DB.
 * 3. Set `socket.data` (role, roomCode, hostToken) and join the Socket.io room.
 * 4. Set `room.hostSocketId` and update the DB.
 * 5. Return `{ roomCode, hostToken }` via the acknowledgement callback.
 * 6. Broadcast the initial state (host receives a HostSnapshot).
 */
function handleCreateRoom(
  _io: AppServer,
  socket: AppSocket,
  payload: CreateRoomPayload,
  ack: ((response: CreateRoomAck) => void) | undefined,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const { hostName, targetPlayers } = payload;

  logger.info('host:create_room', {
    socketId: socket.id,
    hostName,
    targetPlayers,
  });

  // Validate host name
  if (!hostName || typeof hostName !== 'string' || hostName.trim().length === 0) {
    const error = { code: ErrorCodes.INVALID_ACTION, message: 'Host name is required' };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Verify host password (prevents unauthorized room creation).
  const { hostPassword } = payload;
  const expected = config.hostPassword;
  if (!expected) {
    const error = { code: ErrorCodes.INVALID_ACTION, message: 'Server host password not configured' };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }
  const provided = Buffer.from(String(hostPassword ?? ''));
  const expectedBuf = Buffer.from(expected);
  const passwordValid =
    provided.length === expectedBuf.length &&
    crypto.timingSafeEqual(provided, expectedBuf);
  if (!passwordValid) {
    const error = { code: ErrorCodes.INVALID_ACTION, message: '主持人密码错误' };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Validate and normalise target players
  const target = targetPlayers ?? DEFAULT_TARGET_PLAYERS;
  if (target < MIN_PLAYERS || target > MAX_PLAYERS) {
    const error = {
      code: ErrorCodes.INVALID_ACTION,
      message: `Target players must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`,
    };
    broadcaster.sendError(socket, error.code, error.message);
    if (ack) ack({ success: false, error });
    return;
  }

  // Create the room
  const { roomCode, hostToken } = roomManager.createRoom(hostName, target);

  // Set socket data
  socket.join(roomCode);
  socket.data.roomCode = roomCode;
  socket.data.role = 'host';
  socket.data.hostToken = hostToken;

  // Set the host socket ID on the room
  const room = roomManager.getRoom(roomCode);
  if (room) {
    room.hostSocketId = socket.id;

    // Update DB
    try {
      roomRepo.updateRoom(roomCode, { hostId: socket.id });
    } catch (err) {
      logger.error('Failed to set host socket ID in DB', { error: err });
    }

    // Broadcast initial state
    broadcaster.broadcast(room);
  }

  logger.info('Room created by host', {
    socketId: socket.id,
    roomCode,
    hostName,
    targetPlayers: target,
  });

  // Return room code and host token via acknowledgement
  if (ack) {
    ack({ success: true, roomCode, hostToken });
  }
}

// ============================================================================
// host:start_game
// ============================================================================

/**
 * Handle `host:start_game` — start the game.
 *
 * Verifies host identity, then calls `gameEngine.startGame()` which:
 * 1. Validates minimum players are connected.
 * 2. Deals missions to all players.
 * 3. Transitions LOBBY → GAME_INIT → first round.
 *
 * The engine broadcasts the updated state internally.
 */
function handleStartGame(
  socket: AppSocket,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const room = verifyHost(socket, roomManager, broadcaster);
  if (!room) return;

  logger.info('host:start_game', { room: room.code });

  const engine = roomManager.getEngine(room.code);
  if (!engine) {
    broadcaster.sendError(socket, 'INTERNAL_ERROR', 'Game engine not available');
    return;
  }

  engine.startGame();

  // The engine broadcasts internally on both success and failure.
  // On failure (e.g., not enough players), it logs a warning and broadcasts
  // the unchanged state. The host UI will see the error in the state.
}

// ============================================================================
// host:pause / host:resume
// ============================================================================

/**
 * Handle `host:pause` — pause the game.
 *
 * Saves the timer state, clears active timers, and transitions to PAUSED.
 * The engine broadcasts the paused state.
 */
function handlePause(
  socket: AppSocket,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const room = verifyHost(socket, roomManager, broadcaster);
  if (!room) return;

  logger.info('host:pause', { room: room.code });

  const engine = roomManager.getEngine(room.code);
  if (!engine) {
    broadcaster.sendError(socket, 'INTERNAL_ERROR', 'Game engine not available');
    return;
  }

  engine.pause();
}

/**
 * Handle `host:resume` — resume the game from PAUSED.
 *
 * Restores the timer state and transitions back to the phase that was
 * paused. The engine broadcasts the resumed state.
 */
function handleResume(
  socket: AppSocket,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const room = verifyHost(socket, roomManager, broadcaster);
  if (!room) return;

  logger.info('host:resume', { room: room.code });

  const engine = roomManager.getEngine(room.code);
  if (!engine) {
    broadcaster.sendError(socket, 'INTERNAL_ERROR', 'Game engine not available');
    return;
  }

  engine.resume();
}

// ============================================================================
// host:advance_phase
// ============================================================================

/**
 * Handle `host:advance_phase` — manually advance to the next phase.
 *
 * This is a host override that skips any active delay timers and proceeds
 * immediately to the next phase. The exact behaviour depends on the current
 * phase (e.g., skip gem reveal delay, skip number reveal delay, skip current
 * picker in GEM_SELECTION, etc.).
 *
 * The engine broadcasts the updated state internally.
 */
function handleAdvancePhase(
  socket: AppSocket,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const room = verifyHost(socket, roomManager, broadcaster);
  if (!room) return;

  logger.info('host:advance_phase', { room: room.code, phase: room.phase });

  const engine = roomManager.getEngine(room.code);
  if (!engine) {
    broadcaster.sendError(socket, 'INTERNAL_ERROR', 'Game engine not available');
    return;
  }

  engine.advancePhase();
}

// ============================================================================
// host:skip_player
// ============================================================================

/**
 * Handle `host:skip_player` — skip the current gem picker.
 *
 * Clears the current picker's timer and advances to the next picker (or ends
 * the round if no more pickers). This is a host override for players who are
 * disconnected or taking too long.
 *
 * The engine broadcasts the updated state internally.
 */
function handleSkipPlayer(
  socket: AppSocket,
  payload: SkipPlayerPayload,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const room = verifyHost(socket, roomManager, broadcaster);
  if (!room) return;

  const { playerId } = payload;
  if (!playerId) {
    broadcaster.sendError(socket, 'INVALID_ACTION', 'Player ID is required');
    return;
  }

  logger.info('host:skip_player', {
    room: room.code,
    playerId,
    currentPickerId: room.getCurrentPickerId(),
  });

  const engine = roomManager.getEngine(room.code);
  if (!engine) {
    broadcaster.sendError(socket, 'INTERNAL_ERROR', 'Game engine not available');
    return;
  }

  engine.skipPlayer(playerId);
}

// ============================================================================
// host:promote_player
// ============================================================================

/**
 * Handle `host:promote_player` — manually promote a queued player.
 *
 * The host selects a specific queue entry to promote to a full player seat.
 * This is an alternative to auto-promotion (which happens when a player
 * leaves during LOBBY).
 *
 * Flow:
 * 1. Verify host identity.
 * 2. Call `queueManager.promotePlayer(room, queueEntryId)`.
 * 3. Create a new player from the promoted entry.
 * 4. Update the promoted player's socket data.
 * 5. Send `queue:promoted` to the promoted player.
 * 6. Send `player:joined` to the room.
 * 7. Broadcast state and send `queue:update` to the host.
 */
function handlePromotePlayer(
  io: AppServer,
  socket: AppSocket,
  payload: PromotePlayerPayload,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  const room = verifyHost(socket, roomManager, broadcaster);
  if (!room) return;

  const { queueEntryId } = payload;
  if (!queueEntryId) {
    broadcaster.sendError(socket, 'INVALID_ACTION', 'Queue entry ID is required');
    return;
  }

  logger.info('host:promote_player', {
    room: room.code,
    queueEntryId,
  });

  // Only allow promotion during LOBBY or GAME_OVER
  if (room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') {
    broadcaster.sendError(
      socket,
      'INVALID_ACTION',
      'Can only promote players during LOBBY or GAME_OVER phase',
    );
    return;
  }

  // Check if there is space
  if (room.players.size >= room.targetPlayers) {
    broadcaster.sendError(socket, 'ROOM_FULL', 'Room is at target capacity');
    return;
  }

  // Promote the specific queue entry
  const entry = queueManager.promotePlayer(room, queueEntryId);
  if (!entry) {
    broadcaster.sendError(socket, 'PLAYER_NOT_FOUND', 'Queue entry not found');
    return;
  }

  // Create a new player from the promoted entry
  const result = roomManager.addPlayerToRoom(
    room.code,
    entry.playerName,
    entry.socketId ?? '',
    entry.browserFingerprint,
  );

  if (!result) {
    broadcaster.sendError(socket, 'INVALID_ACTION', 'Failed to create player from queue entry');
    // Re-add to queue?
    return;
  }

  // Update the promoted player's socket data
  if (entry.socketId) {
    const promotedSocket = io.sockets.sockets.get(entry.socketId);
    if (promotedSocket) {
      promotedSocket.data.role = 'player';
      promotedSocket.data.playerId = result.player.id;
      promotedSocket.data.queueEntryId = undefined;
      if (entry.browserFingerprint) {
        promotedSocket.data.fingerprint = entry.browserFingerprint;
      }
    }
  }

  // Notify the promoted player
  if (entry.socketId) {
    io.to(entry.socketId).emit('queue:promoted', {
      playerId: result.player.id,
      authToken: result.authToken,
      seatNumber: result.player.seatNumber,
    });
  }

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

  logger.info('Queue player promoted by host', {
    room: room.code,
    playerId: result.player.id,
    name: result.player.name,
    seat: result.player.seatNumber,
  });
}

// ============================================================================
// host:remove_from_queue
// ============================================================================

/**
 * Handle `host:remove_from_queue` — remove a player from the waiting queue.
 *
 * The host can remove a specific queue entry. The player is removed from the
 * queue and the remaining entries are re-indexed.
 *
 * Flow:
 * 1. Verify host identity.
 * 2. Call `queueManager.removeFromQueue(room, queueEntryId)`.
 * 3. Send `queue:update` to the host.
 * 4. Broadcast state.
 */
function handleRemoveFromQueue(
  io: AppServer,
  socket: AppSocket,
  payload: RemoveFromQueuePayload,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  const room = verifyHost(socket, roomManager, broadcaster);
  if (!room) return;

  const { queueEntryId } = payload;
  if (!queueEntryId) {
    broadcaster.sendError(socket, 'INVALID_ACTION', 'Queue entry ID is required');
    return;
  }

  logger.info('host:remove_from_queue', {
    room: room.code,
    queueEntryId,
  });

  // Remove from queue
  queueManager.removeFromQueue(room, queueEntryId);

  // Notify host of queue update
  broadcaster.sendQueueUpdate(room, room.queue);

  // Broadcast updated state
  broadcaster.broadcast(room);
}

// ============================================================================
// host:end_game
// ============================================================================

/**
 * Handle `host:end_game` — end the game early.
 *
 * Transitions directly to GAME_OVER, clearing all timers. This is used when
 * the host decides to end the game before all 6 rounds are complete.
 *
 * Flow:
 * 1. Verify host identity.
 * 2. Set `room.phase = 'GAME_OVER'` and `room.revealedResultsCount` to full.
 * 3. Update the DB.
 * 4. Broadcast the final state.
 */
function handleEndGame(
  socket: AppSocket,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const room = verifyHost(socket, roomManager, broadcaster);
  if (!room) return;

  logger.info('host:end_game', { room: room.code, phase: room.phase });

  // Clear all timers for the room
  const timerManager = roomManager.getTimerManager(room.code);
  if (timerManager) {
    timerManager.clearAll();
  }

  // Transition to GAME_OVER
  room.phase = 'GAME_OVER';
  room.isPaused = false;
  room.pausedPhase = null;
  room.timerRemaining = 0;
  room.timerDeadline = null;

  // If final results haven't been calculated, do a quick calculation
  if (room.finalResults.length === 0) {
    // Set revealedResultsCount to 0 since there are no results
    room.revealedResultsCount = 0;
  } else {
    room.revealedResultsCount = room.finalResults.length;
  }

  // Update DB
  try {
    roomRepo.updateRoom(room.code, {
      phase: 'GAME_OVER',
      isPaused: false,
      pausedPhase: null,
      timerRemaining: 0,
      timerDeadline: null,
    });
  } catch (err) {
    logger.error('Failed to update room phase in DB', { error: err });
  }

  // Broadcast final state
  broadcaster.broadcast(room);
}

// ============================================================================
// host:restart
// ============================================================================

/**
 * Handle `host:restart` — restart the game for a new round.
 *
 * Resets the room state for a new game:
 * 1. Increments `gameSession` (invalidates all old player auth tokens —
 *    cross-game isolation).
 * 2. Resets all game state (phase → LOBBY, round → 0, gems, scores, etc.).
 * 3. Resets each player's game data (numbers, gems, missions, scores).
 * 4. Queue players can now be promoted to seats if there is space.
 * 5. Broadcasts the new state.
 *
 * The engine's `restartGame()` method handles steps 1–3 internally.
 * After restart, the host can use `host:promote_player` to promote queue
 * players to available seats.
 */
function handleRestart(
  socket: AppSocket,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const room = verifyHost(socket, roomManager, broadcaster);
  if (!room) return;

  logger.info('host:restart', { room: room.code, oldSession: room.gameSession });

  const engine = roomManager.getEngine(room.code);
  if (!engine) {
    broadcaster.sendError(socket, 'INTERNAL_ERROR', 'Game engine not available');
    return;
  }

  // Restart the game (increments gameSession, resets state)
  engine.restartGame();

  // The engine has already broadcast the new state.
  // Old player tokens are invalidated because gameSession was incremented.
  // Players will need to re-authenticate using the new session.

  logger.info('Game restarted', {
    room: room.code,
    newSession: room.gameSession,
    players: room.players.size,
    queueLength: room.queue.length,
  });
}
