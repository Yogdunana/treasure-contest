import type { DefaultEventsMap, RemoteSocket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  StateSnapshot,
  TimerTickPayload,
  ErrorPayload,
  ErrorCode,
  QueueEntry,
} from '@treasure-contest/shared';
import type { Room } from '../game/room.js';
import type { AppServer, AppSocket, SocketData } from './middleware.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Broadcaster: role-filtered state synchronization
// ============================================================================

/**
 * Handles broadcasting game state to connected clients.
 *
 * The core challenge of a multi-client game is ensuring each client receives
 * only the state they are authorised to see:
 *
 * - **Screen** (big-screen display): Public game state only — no secrets.
 * - **Player**: Public game state + their own private state (numbers, gems,
 *   missions, scores).
 * - **Host** (control panel): Public game state + full host state (all
 *   players' data, queue list, event log, mission overview).
 * - **Queued** (waiting queue): Queue position and room overview only.
 *
 * The `broadcast()` method fetches all sockets in a Socket.io room, inspects
 * each socket's `data.role`, builds the appropriate `StateSnapshot`, and
 * emits it via the `state:sync` event.
 *
 * The broadcast function is fire-and-forget (async internally) so it can be
 * used as the `BroadcastFn` callback expected by `RoomManager` and
 * `GameEngine`, which call it synchronously.
 */
export class Broadcaster {
  constructor(private io: AppServer) {}

  // ========================================================================
  // Main broadcast: send role-filtered state to all sockets in a room
  // ========================================================================

  /**
   * Broadcast the current room state to all connected clients in that room.
   *
   * For each socket in the room, a role-filtered `StateSnapshot` is built
   * and sent via the `state:sync` event:
   *
   * - `screen` → `ScreenSnapshot` (public state only)
   * - `player` → `PlayerSnapshot` (public + own private state)
   * - `host`   → `HostSnapshot` (public + full host state)
   * - `queued` → `QueuedSnapshot` (queue position + room overview)
   *
   * This method is async internally but called fire-and-forget by the
   * `BroadcastFn` callback (which has a `void` return type). Any errors
   * during the fetch are logged but do not crash the caller.
   */
  broadcast(room: Room): void {
    // Fire-and-forget: the BroadcastFn signature is (room: Room) => void,
    // but fetchSockets() is async. We resolve the promise in the background.
    this.io
      .in(room.code)
      .fetchSockets()
      .then((sockets) => {
        for (const remoteSocket of sockets) {
          const snapshot = this.buildSnapshot(room, remoteSocket.data);
          if (snapshot) {
            remoteSocket.emit('state:sync', snapshot);
          }
        }
      })
      .catch((err: unknown) => {
        logger.error('Broadcast failed (fetchSockets)', {
          room: room.code,
          error: err,
        });
      });
  }

  // ========================================================================
  // Timer broadcast
  // ========================================================================

  /**
   * Broadcast a timer tick to all clients in a room.
   *
   * Called every second during active countdown phases (NUMBER_SELECTION
   * and GEM_SELECTION). The `currentPlayerId` is set during GEM_SELECTION
   * so clients know whose turn it is.
   *
   * @param room            The room to broadcast to.
   * @param remaining       Remaining seconds in the countdown.
   * @param currentPlayerId The player currently picking (GEM_SELECTION only).
   */
  broadcastTimer(room: Room, remaining: number, currentPlayerId?: string): void {
    const payload: TimerTickPayload = {
      remaining,
      phase: room.phase,
      ...(currentPlayerId !== undefined ? { currentPlayerId } : {}),
    };
    this.io.to(room.code).emit('timer:tick', payload);
  }

  // ========================================================================
  // Error notification
  // ========================================================================

  /**
   * Send an error notification to a specific socket.
   *
   * @param socket  The target socket.
   * @param code    One of the {@link ErrorCodes} values.
   * @param message Human-readable error message.
   */
  sendError(socket: AppSocket, code: ErrorCode, message: string): void {
    const payload: ErrorPayload = { code, message };
    socket.emit('error', payload);
  }

  // ========================================================================
  // Direct message to a specific player
  // ========================================================================

  /**
   * Send a specific server-to-client event to a single socket.
   *
   * Used for targeted notifications like `player:joined`, `queue:promoted`,
   * etc. that should only go to one client rather than being broadcast to
   * the whole room.
   *
   * @param socket  The target socket.
   * @param event   The server-to-client event name.
   * @param data    The event payload.
   */
  sendToPlayer(socket: AppSocket, event: string, data: unknown): void {
    // Cast required because the typed emit() signature enforces specific
    // event/payload pairs, but this helper is intentionally generic.
    (socket.emit as (event: string, data: unknown) => void)(event, data);
  }

  // ========================================================================
  // Queue update (host only)
  // ========================================================================

  /**
   * Send a queue list update to the host socket of a room.
   *
   * Called whenever the queue changes (join, leave, promote, remove).
   *
   * @param room       The room whose queue changed.
   * @param queueList  The full queue entry list.
   */
  sendQueueUpdate(room: Room, queueList: QueueEntry[]): void {
    if (room.hostSocketId) {
      this.io.to(room.hostSocketId).emit('queue:update', {
        queueList,
        totalInQueue: queueList.length,
      });
    }
  }

  // ========================================================================
  // Snapshot builder (private)
  // ========================================================================

  /**
   * Build the role-filtered `StateSnapshot` for a single client.
   *
   * @param room   The room to build the snapshot from.
   * @param data   The socket's data (role, playerId, queueEntryId).
   * @returns The appropriate snapshot variant, or `null` if the role is
   *          unknown or required data is missing.
   */
  private buildSnapshot(room: Room, data: SocketData): StateSnapshot | null {
    const base = {
      roomCode: room.code,
      phase: room.phase,
      currentRound: room.currentRound,
      timestamp: Date.now(),
    };

    switch (data.role) {
      case 'screen': {
        return {
          ...base,
          role: 'screen',
          publicGameState: room.toPublicState(),
        };
      }

      case 'host': {
        return {
          ...base,
          role: 'host',
          publicGameState: room.toPublicState(),
          hostState: room.toHostState(),
        };
      }

      case 'player': {
        if (!data.playerId) {
          logger.warn('Player snapshot requested but no playerId on socket', {
            socketRoom: room.code,
          });
          return null;
        }
        const privateState = room.toPlayerPrivateState(data.playerId);
        if (!privateState) {
          // Player may have been removed; skip this socket
          return null;
        }
        return {
          ...base,
          role: 'player',
          playerId: data.playerId,
          publicGameState: room.toPublicState(),
          privateState,
        };
      }

      case 'queued': {
        return {
          ...base,
          role: 'queued',
          queueState: room.toQueueState(data.queueEntryId),
        };
      }

      default:
        // Unknown or unauthenticated role — no snapshot
        return null;
    }
  }
}

// ============================================================================
// Re-export for convenience
// ============================================================================

export type { RemoteSocket };
