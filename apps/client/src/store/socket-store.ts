/**
 * Socket store — manages the Socket.io connection lifecycle and wires all
 * server-to-client events into the game store.
 *
 * Responsibilities:
 * 1. Track connection status (isConnected, isConnecting, error)
 * 2. `connect(roomCode, role)` — open the socket and register listeners
 * 3. `disconnect()` — tear down listeners and close the socket
 *
 * Every server event handler delegates to `useGameStore` so that React
 * components re-render automatically when state changes.
 */

import { create } from 'zustand';
import { socket } from '../lib/socket-client';
import { useGameStore } from './game-store';
import { useUIStore } from './ui-store';
import { saveAuthToLocal, getAuthFromLocal, generateFingerprint, getHostAuth } from '../lib/auth-storage';
import { persistPlayerSession } from '../lib/session';
import type {
  ClientRole,
  StateSnapshot,
  TimerInfo,
  ErrorPayload,
  QueueStatusUpdate,
  QueuePromotedPayload,
  QueueUpdatePayload,
  TimerTickPayload,
  RoomJoinAck,
} from '@treasure-contest/shared';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface SocketStore {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Connection context
  roomCode: string | null;
  role: ClientRole | null;

  // Actions
  connect: (roomCode: string, role: ClientRole) => void;
  /** Emit the role-specific join/reconnect for an already-open socket. */
  ensureJoined: (roomCode?: string, role?: ClientRole) => void;
  disconnect: () => void;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Event handler registration
// ---------------------------------------------------------------------------

/**
 * Registers all server-to-client event listeners on the socket.
 * These listeners update the game store and UI store in response to
 * server pushes.
 *
 * Called once during `connect()`; the listeners are removed in `disconnect()`.
 */
function registerEventListeners(): void {
  // ── Connection lifecycle ──────────────────────────────────────────────
  socket.on('connect', () => {
    useSocketStore.setState({
      isConnected: true,
      isConnecting: false,
      error: null,
    });
    useUIStore.getState().setShowDisconnectedBanner(false);

    // After a transport reconnect the socket is a new ID and is no longer
    // in the Socket.io room. Re-join so broadcasts resume.
    useSocketStore.getState().ensureJoined();
  });

  socket.on('disconnect', () => {
    useSocketStore.setState({ isConnected: false });
    useUIStore.getState().setShowDisconnectedBanner(true);
  });

  socket.on('connect_error', (err: Error) => {
    useSocketStore.setState({
      isConnected: false,
      isConnecting: false,
      error: err.message,
    });
  });

  // ── State sync (the main event — full state snapshot) ─────────────────
  socket.on('state:sync', (snapshot: StateSnapshot) => {
    useGameStore.getState().setSnapshot(snapshot);
  });

  // ── Timer ticks ───────────────────────────────────────────────────────
  socket.on('timer:tick', (payload: TimerTickPayload) => {
    const timer: TimerInfo = {
      remaining: payload.remaining,
      deadline: null,
      currentPlayerId: payload.currentPlayerId,
    };
    useGameStore.getState().setTimer(timer);
  });

  // ── Player lifecycle (state:sync will follow with updated state) ────
  // These are notification-only; the subsequent state:sync event carries
  // the authoritative updated player list.

  // ── Queue events ──────────────────────────────────────────────────────
  socket.on('queue:status', (payload: QueueStatusUpdate) => {
    useGameStore.setState({
      queuePosition: payload.position,
      totalInQueue: payload.totalInQueue,
    });
  });

  socket.on('queue:promoted', (payload: QueuePromotedPayload) => {
    // The player has been promoted from the queue to a full seat.
    // Save the new auth token for future reconnection, then the server
    // will send a fresh state:sync with the player snapshot.
    const roomCode = useSocketStore.getState().roomCode;
    if (roomCode) {
      saveAuthToLocal(roomCode, payload.playerId, payload.authToken);
      void persistPlayerSession(payload.playerId, roomCode, payload.authToken);
    }
    useGameStore.setState({
      playerId: payload.playerId,
      queuePosition: null,
      totalInQueue: null,
    });
  });

  socket.on('queue:update', (payload: QueueUpdatePayload) => {
    useGameStore.setState({
      queueList: payload.queueList,
      queueCount: payload.totalInQueue,
      totalInQueue: payload.totalInQueue,
    });
  });

  // ── Error ─────────────────────────────────────────────────────────────
  socket.on('error', (payload: ErrorPayload) => {
    useSocketStore.setState({ error: payload.message });
  });
}

/**
 * Removes all registered event listeners.
 * Called during `disconnect()`.
 */
function removeEventListeners(): void {
  socket.removeAllListeners();
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useSocketStore = create<SocketStore>((set, get) => ({
  isConnected: false,
  isConnecting: false,
  error: null,
  roomCode: null,
  role: null,

  ensureJoined: (roomCode, role) => {
    const state = get();
    const code = roomCode ?? state.roomCode;
    const nextRole = role ?? state.role;
    if (!code || code === '__pending__' || !nextRole) return;
    if (!socket.connected) return;

    if (role || roomCode) {
      set({
        roomCode: code,
        role: nextRole,
      });
    }

    if (nextRole === 'host') {
      const host = getHostAuth(code);
      if (host?.hostToken) {
        socket.emit('room:join', {
          roomCode: code,
          playerName: host.hostName || 'host',
          role: 'host',
          hostToken: host.hostToken,
        });
      }
    } else if (nextRole === 'screen') {
      socket.emit(
        'room:join',
        {
          roomCode: code,
          playerName: 'screen',
          role: 'screen',
        },
        (_ack: RoomJoinAck) => {
          // Ack is optional; state:sync is the source of truth.
        },
      );
    } else if (nextRole === 'player') {
      const stored = getAuthFromLocal(code);
      if (stored) {
        socket.emit('room:reconnect', {
          roomCode: code,
          playerId: stored.playerId,
          authToken: stored.authToken,
        });
      }
    }
  },

  connect: (roomCode, role) => {
    set({
      error: null,
      roomCode,
      role,
    });

    if (role === 'host') {
      const host = getHostAuth(roomCode);
      if (host?.hostToken) {
        socket.auth = { hostToken: host.hostToken };
      }
    }

    // Socket already open (e.g. host tab later opens /screen/:code, or
    // React remount). Do not no-op — emit the role join immediately.
    if (socket.connected) {
      set({ isConnected: true, isConnecting: false });
      get().ensureJoined(roomCode, role);
      return;
    }

    if (get().isConnecting) {
      // Handshake in flight; the connect handler will ensureJoined
      // with the role/roomCode we just stored.
      return;
    }

    set({ isConnecting: true });

    // Register listeners before connecting so we don't miss the initial
    // state:sync event that the server sends immediately on connection.
    registerEventListeners();
    socket.connect();

    const stored = getAuthFromLocal(roomCode);
    if (!stored) {
      generateFingerprint();
    }
  },

  disconnect: () => {
    removeEventListeners();
    socket.disconnect();
    set({
      isConnected: false,
      isConnecting: false,
      error: null,
      roomCode: null,
      role: null,
    });
    useGameStore.getState().reset();
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useSocketStore;
