import type { SubmitNumberPayload, SelectGemPayload, ErrorCode } from '@treasure-contest/shared';
import { ErrorCodes } from '@treasure-contest/shared';
import type { RoomManager } from '../game/room-manager.js';
import type { Broadcaster } from './broadcaster.js';
import type { AppServer, AppSocket } from './middleware.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Action handler setup
// ============================================================================

/**
 * Register player game-action event handlers on a socket.
 *
 * Handles:
 * - `action:submit_number` — Player submits their number choice during
 *   NUMBER_SELECTION. The game engine validates the submission, updates
 *   state, broadcasts, and auto-proceeds to NUMBER_REVEAL if all players
 *   have submitted.
 * - `action:select_gem` — Player selects a gem during GEM_SELECTION.
 *   The game engine validates, assigns the gem, broadcasts, and advances
 *   to the next picker (or ends the round if all gems are picked).
 *
 * Both handlers follow the same pattern:
 * 1. Resolve the room and game engine from `socket.data`.
 * 2. Call the appropriate engine method.
 * 3. If the engine returns an error, send it to the socket.
 * 4. If successful, the engine has already broadcast the updated state
 *    internally (via its `broadcastFn`), so no explicit broadcast is needed.
 *
 * @param io           The Socket.io server instance.
 * @param socket       The individual socket connection.
 * @param roomManager  The room manager singleton.
 * @param broadcaster  The broadcaster (used for sending errors).
 */
export function setupActionHandlers(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  // -- action:submit_number ------------------------------------------------
  socket.on('action:submit_number', (payload: SubmitNumberPayload) => {
    handleSubmitNumber(socket, payload, roomManager, broadcaster);
  });

  socket.on('action:select_gem', (payload: SelectGemPayload) => {
    handleSelectGem(socket, payload, roomManager, broadcaster);
  });

  socket.on('action:confirm_briefing', () => {
    handleConfirmBriefing(socket, roomManager, broadcaster);
  });
}

// ============================================================================
// action:submit_number
// ============================================================================

/**
 * Handle a player's number submission during NUMBER_SELECTION.
 *
 * Flow:
 * 1. Resolve the room and player from `socket.data`.
 * 2. Call `gameEngine.onNumberSubmitted(playerId, number)`.
 * 3. On error: send the error code and message to the socket.
 * 4. On success: the engine has already broadcast the updated state and
 *    checked if all players have submitted (auto-proceeding to NUMBER_REVEAL
 *    if so). No further action needed from this handler.
 *
 * Possible errors from the engine:
 * - Phase is not NUMBER_SELECTION (INVALID_ACTION)
 * - Player not found (PLAYER_NOT_FOUND)
 * - Player not connected (INVALID_ACTION)
 * - Already submitted this round (NUMBER_ALREADY_USED)
 * - Number not in available numbers (INVALID_ACTION)
 */
function handleSubmitNumber(
  socket: AppSocket,
  payload: SubmitNumberPayload,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const roomCode = socket.data.roomCode;
  const playerId = socket.data.playerId;

  // Validate that the socket belongs to a player in a room
  if (!roomCode || !playerId) {
    broadcaster.sendError(
      socket,
      'PLAYER_NOT_FOUND',
      'You are not in a room. Please join a room first.',
    );
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    broadcaster.sendError(socket, 'ROOM_NOT_FOUND', `Room ${roomCode} not found`);
    return;
  }

  const engine = roomManager.getEngine(roomCode);
  if (!engine) {
    broadcaster.sendError(socket, 'INTERNAL_ERROR', 'Game engine not available');
    return;
  }

  // Validate the payload
  const { number } = payload;
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1 || number > 7) {
    broadcaster.sendError(socket, 'INVALID_ACTION', 'Number must be an integer between 1 and 7');
    return;
  }

  logger.debug('action:submit_number', {
    socketId: socket.id,
    roomCode,
    playerId,
    number,
  });

  // Call the game engine
  const result = engine.onNumberSubmitted(playerId, number);

  if (!result.success) {
    // Determine the appropriate error code based on the error message
    const errorCode = mapEngineError(result.error);
    broadcaster.sendError(socket, errorCode, result.error ?? 'Invalid action');
    logger.warn('Number submission failed', {
      roomCode,
      playerId,
      number,
      error: result.error,
    });
    return;
  }

  // Success: the engine has already broadcast the updated state.
  // If all players submitted, the engine auto-proceeds to NUMBER_REVEAL.
  logger.info('Number submitted', {
    roomCode,
    playerId,
    number,
  });
}

// ============================================================================
// action:select_gem
// ============================================================================

/**
 * Handle a player's gem selection during GEM_SELECTION.
 *
 * Flow:
 * 1. Resolve the room and player from `socket.data`.
 * 2. Call `gameEngine.onGemSelected(playerId, gemId)`.
 * 3. On error: send the error code and message to the socket.
 * 4. On success: the engine has already broadcast the updated state and
 *    advanced to the next picker (or ended the round if all gems are picked).
 *
 * Possible errors from the engine:
 * - Phase is not GEM_SELECTION (INVALID_ACTION)
 * - Player not found (PLAYER_NOT_FOUND)
 * - Not the player's turn (NOT_YOUR_TURN)
 * - Gem already picked (GEM_ALREADY_PICKED)
 * - Gem not found (GEM_NOT_FOUND)
 */
function handleSelectGem(
  socket: AppSocket,
  payload: SelectGemPayload,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const roomCode = socket.data.roomCode;
  const playerId = socket.data.playerId;

  // Validate that the socket belongs to a player in a room
  if (!roomCode || !playerId) {
    broadcaster.sendError(
      socket,
      'PLAYER_NOT_FOUND',
      'You are not in a room. Please join a room first.',
    );
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    broadcaster.sendError(socket, 'ROOM_NOT_FOUND', `Room ${roomCode} not found`);
    return;
  }

  const engine = roomManager.getEngine(roomCode);
  if (!engine) {
    broadcaster.sendError(socket, 'INTERNAL_ERROR', 'Game engine not available');
    return;
  }

  // Validate the payload
  const { gemId } = payload;
  if (!gemId || typeof gemId !== 'string') {
    broadcaster.sendError(socket, 'INVALID_ACTION', 'Gem ID is required');
    return;
  }

  logger.debug('action:select_gem', {
    socketId: socket.id,
    roomCode,
    playerId,
    gemId,
  });

  // Call the game engine
  const result = engine.onGemSelected(playerId, gemId);

  if (!result.success) {
    // Determine the appropriate error code based on the error message
    const errorCode = mapEngineError(result.error);
    broadcaster.sendError(socket, errorCode, result.error ?? 'Invalid action');
    logger.warn('Gem selection failed', {
      roomCode,
      playerId,
      gemId,
      error: result.error,
    });
    return;
  }

  // Success: the engine has already broadcast the updated state and
  // advanced to the next picker (or ended the round).
  logger.info('Gem selected', {
    roomCode,
    playerId,
    gemId,
  });
}

// ============================================================================
// action:confirm_briefing
// ============================================================================

function handleConfirmBriefing(
  socket: AppSocket,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
): void {
  const roomCode = socket.data.roomCode;
  const playerId = socket.data.playerId;

  if (!roomCode || !playerId) {
    broadcaster.sendError(
      socket,
      'PLAYER_NOT_FOUND',
      'You are not in a room. Please join a room first.',
    );
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    broadcaster.sendError(socket, 'ROOM_NOT_FOUND', `Room ${roomCode} not found`);
    return;
  }

  const engine = roomManager.getEngine(roomCode);
  if (!engine) {
    broadcaster.sendError(socket, 'INTERNAL_ERROR', 'Game engine not available');
    return;
  }

  const result = engine.onBriefingConfirmed(playerId);
  if (!result.success) {
    const errorCode = mapEngineError(result.error);
    broadcaster.sendError(socket, errorCode, result.error ?? 'Invalid action');
    logger.warn('Briefing confirm failed', {
      roomCode,
      playerId,
      error: result.error,
    });
    return;
  }

  logger.info('Briefing confirmed', { roomCode, playerId, phase: room.phase });
}

// ============================================================================
// Helper: map engine error messages to error codes
// ============================================================================

/**
 * Map a game engine error message to the appropriate `ErrorCode`.
 *
 * The state machine returns plain-text error messages; the socket layer
 * needs to send structured `ErrorPayload` with a code. This function inspects
 * the error text and returns the closest matching error code.
 *
 * @param error The error message from the state machine.
 * @returns The best-matching error code.
 */
function mapEngineError(error: string | undefined): ErrorCode {
  if (!error) return ErrorCodes.INVALID_ACTION;

  const lower = error.toLowerCase();

  if (lower.includes('not your turn') || lower.includes('current picker')) {
    return ErrorCodes.NOT_YOUR_TURN;
  }
  if (lower.includes('already submitted') || lower.includes('already used')) {
    return ErrorCodes.NUMBER_ALREADY_USED;
  }
  if (lower.includes('already picked') || lower.includes('already been picked')) {
    return ErrorCodes.GEM_ALREADY_PICKED;
  }
  if (lower.includes('gem') && lower.includes('not found')) {
    return ErrorCodes.GEM_NOT_FOUND;
  }
  if (lower.includes('player not found') || lower.includes('player is not')) {
    return ErrorCodes.PLAYER_NOT_FOUND;
  }
  if (lower.includes('not connected')) {
    return ErrorCodes.PLAYER_NOT_FOUND;
  }

  return ErrorCodes.INVALID_ACTION;
}
