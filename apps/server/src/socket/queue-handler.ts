import type { QueueJoinPayload } from '@treasure-contest/shared';
import { QUEUE_CONFIG } from '@treasure-contest/shared';
import type { RoomManager } from '../game/room-manager.js';
import type { QueueManager } from '../game/queue-manager.js';
import type { Broadcaster } from './broadcaster.js';
import type { AppServer, AppSocket } from './middleware.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Queue handler setup
// ============================================================================

/**
 * Register queue-related event handlers on a socket.
 *
 * Handles:
 * - `queue:join` — Join the waiting queue when the room is full.
 *   Allowed during LOBBY and GAME_OVER phases.
 * - `queue:leave` — Leave the waiting queue.
 *
 * @param io            The Socket.io server instance.
 * @param socket        The individual socket connection.
 * @param roomManager   The room manager singleton.
 * @param queueManager  The queue manager singleton.
 * @param broadcaster   The broadcaster for sending state to clients.
 */
export function setupQueueHandlers(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  // -- queue:join ----------------------------------------------------------
  socket.on('queue:join', (payload: QueueJoinPayload) => {
    handleQueueJoin(io, socket, payload, roomManager, queueManager, broadcaster);
  });

  // -- queue:leave --------------------------------------------------------
  socket.on('queue:leave', () => {
    handleQueueLeave(io, socket, roomManager, queueManager, broadcaster);
  });
}

// ============================================================================
// queue:join
// ============================================================================

/**
 * Handle `queue:join` — join the waiting queue.
 *
 * Flow:
 * 1. Verify the room exists.
 * 2. Verify the room is in LOBBY or GAME_OVER phase (queue joining is
 *    allowed during these phases so players can wait for the next game).
 * 3. Verify the queue is not full (< MAX_QUEUE_SIZE).
 * 4. Check for duplicate name in the queue.
 * 5. Add to the queue via `queueManager.addToQueue()`.
 * 6. Set `socket.data` (role = 'queued', queueEntryId).
 * 7. Join the Socket.io room (so the queued player receives state updates).
 * 8. Send `queue:status` to the player with their position and estimated wait.
 * 9. Send `queue:update` to the host with the full queue list.
 * 10. Broadcast state (queued player receives a QueuedSnapshot).
 *
 * @param io            The Socket.io server.
 * @param socket        The player's socket.
 * @param payload       The queue join payload (roomCode, playerName, fingerprint).
 * @param roomManager   The room manager.
 * @param queueManager  The queue manager.
 * @param broadcaster   The broadcaster.
 */
function handleQueueJoin(
  io: AppServer,
  socket: AppSocket,
  payload: QueueJoinPayload,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  const { roomCode, playerName, fingerprint } = payload;

  logger.info('queue:join', {
    socketId: socket.id,
    roomCode,
    playerName,
    hasFingerprint: fingerprint !== undefined,
  });

  // Validate required fields
  if (!roomCode) {
    broadcaster.sendError(socket, 'INVALID_ACTION', 'Room code is required');
    return;
  }
  if (!playerName || playerName.trim().length === 0) {
    broadcaster.sendError(socket, 'INVALID_ACTION', 'Player name is required');
    return;
  }

  // Verify the room exists
  const room = roomManager.getRoom(roomCode);
  if (!room) {
    broadcaster.sendError(socket, 'ROOM_NOT_FOUND', `Room ${roomCode} not found`);
    return;
  }

  // Verify the room is in a phase that allows queue joining
  if (room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') {
    broadcaster.sendError(
      socket,
      'GAME_ALREADY_STARTED',
      'Cannot join queue during an active game. Please wait for the game to end.',
    );
    return;
  }

  // Verify the queue is not full
  if (room.queue.length >= QUEUE_CONFIG.MAX_QUEUE_SIZE) {
    broadcaster.sendError(
      socket,
      'QUEUE_FULL',
      `Queue is full (max ${QUEUE_CONFIG.MAX_QUEUE_SIZE} players)`,
    );
    return;
  }

  // Check for duplicate name in the queue
  const nameInQueue = room.queue.some((entry) => entry.playerName === playerName);
  if (nameInQueue) {
    broadcaster.sendError(socket, 'NAME_TAKEN', `Name "${playerName}" is already in the queue`);
    return;
  }

  // Also check if the name is already taken by an active player
  const nameInRoom = Array.from(room.players.values()).some((p) => p.name === playerName);
  if (nameInRoom) {
    broadcaster.sendError(socket, 'NAME_TAKEN', `Name "${playerName}" is already taken`);
    return;
  }

  // Add to the queue
  const entry = queueManager.addToQueue(
    room,
    playerName,
    socket.id,
    fingerprint,
  );

  if (!entry) {
    broadcaster.sendError(socket, 'QUEUE_FULL', 'Failed to join queue');
    return;
  }

  // Set socket data for the queued role
  socket.join(roomCode);
  socket.data.roomCode = roomCode;
  socket.data.role = 'queued';
  socket.data.queueEntryId = entry.id;
  if (fingerprint) {
    socket.data.fingerprint = fingerprint;
  }

  // Send queue status to the player
  const estimatedWait = `${Math.ceil(entry.position * 5)} minutes`;
  socket.emit('queue:status', {
    position: entry.position,
    totalInQueue: room.queue.length,
    estimatedWait,
  });

  // Send queue update to the host
  broadcaster.sendQueueUpdate(room, room.queue);

  // Broadcast state (queued player gets a QueuedSnapshot)
  broadcaster.broadcast(room);

  logger.info('Player joined queue', {
    room: roomCode,
    playerName,
    position: entry.position,
    queueSize: room.queue.length,
  });
}

// ============================================================================
// queue:leave
// ============================================================================

/**
 * Handle `queue:leave` — leave the waiting queue.
 *
 * Flow:
 * 1. Verify the socket is in a queued role.
 * 2. Find the room and queue entry.
 * 3. Remove from the queue via `queueManager.removeFromQueue()`.
 * 4. Send `queue:update` to the host.
 * 5. Broadcast state.
 * 6. Clear the socket's queued role data.
 *
 * @param io            The Socket.io server.
 * @param socket        The player's socket.
 * @param roomManager   The room manager.
 * @param queueManager  The queue manager.
 * @param broadcaster   The broadcaster.
 */
function handleQueueLeave(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  queueManager: QueueManager,
  broadcaster: Broadcaster,
): void {
  const roomCode = socket.data.roomCode;
  const role = socket.data.role;
  const queueEntryId = socket.data.queueEntryId;

  logger.info('queue:leave', {
    socketId: socket.id,
    roomCode: roomCode ?? null,
    queueEntryId: queueEntryId ?? null,
  });

  // Verify the socket is in a queued role
  if (role !== 'queued') {
    broadcaster.sendError(socket, 'INVALID_ACTION', 'You are not in the queue');
    return;
  }

  if (!roomCode) {
    broadcaster.sendError(socket, 'INVALID_ACTION', 'No room associated with this connection');
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    broadcaster.sendError(socket, 'ROOM_NOT_FOUND', `Room ${roomCode} not found`);
    // Still clear socket data
    socket.leave(roomCode);
    socket.data.role = undefined;
    socket.data.queueEntryId = undefined;
    socket.data.roomCode = undefined;
    return;
  }

  // Remove from queue
  if (queueEntryId) {
    queueManager.removeFromQueue(room, queueEntryId);
  } else {
    // Try to find by socket ID
    const entry = queueManager.findBySocketId(room, socket.id);
    if (entry) {
      queueManager.removeFromQueue(room, entry.id);
    }
  }

  // Send queue update to the host
  broadcaster.sendQueueUpdate(room, room.queue);

  // Broadcast state
  broadcaster.broadcast(room);

  // Clear socket data
  socket.leave(roomCode);
  socket.data.role = undefined;
  socket.data.queueEntryId = undefined;
  socket.data.roomCode = undefined;

  logger.info('Player left queue', {
    room: roomCode,
    queueSize: room.queue.length,
  });
}
