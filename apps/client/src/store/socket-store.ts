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
  /**
   * Screen projector path: register listeners, open the socket if needed,
   * and emit `room:join` with role=screen. Applies the ack snapshot so a
   * missed `state:sync` cannot leave the display empty.
   */
  joinAsScreen: (roomCode: string) => void;
  disconnect: () => void;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Event handler registration
// ---------------------------------------------------------------------------

let listenersBound = false;

function ensureEventListeners(): void {
  if (listenersBound) return;
  listenersBound = true;
  registerEventListeners();
}

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
    if (
      snapshot.role === 'player' &&
      snapshot.privateState.authToken
    ) {
      saveAuthToLocal(
        snapshot.roomCode,
        snapshot.privateState.playerId,
        snapshot.privateState.authToken,
      );
      void persistPlayerSession(
        snapshot.privateState.playerId,
        snapshot.roomCode,
        snapshot.privateState.authToken,
      );
    }
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
    const role = useSocketStore.getState().role;
    // Screen tabs retry until the room exists (host may still be creating it).
    if (role === 'screen' && payload.code === 'ROOM_NOT_FOUND') {
      return;
    }
    useSocketStore.setState({ error: payload.message });
  });
}

/**
 * Removes all registered event listeners.
 * Called during `disconnect()`.
 */
function removeEventListeners(): void {
  socket.removeAllListeners();
  listenersBound = false;
}

function applyJoinAck(ack: RoomJoinAck | undefined): void {
  if (!ack?.success) {
    if (ack?.error?.code === 'ROOM_NOT_FOUND') return;
    if (ack?.error?.message) {
      useSocketStore.setState({ error: ack.error.message });
    }
    return;
  }
  useSocketStore.setState({ error: null });
  if (ack.snapshot) {
    useGameStore.getState().setSnapshot(ack.snapshot);
  }
  if (ack.playerId && ack.authToken && ack.roomCode) {
    saveAuthToLocal(ack.roomCode, ack.playerId, ack.authToken);
    void persistPlayerSession(ack.playerId, ack.roomCode, ack.authToken);
  }
}

function applyScreenJoinAck(ack: RoomJoinAck): void {
  if (!ack) return;
  if (ack.success) {
    useSocketStore.setState({ error: null });
    if (ack.snapshot?.role === 'screen') {
      useGameStore.getState().setSnapshot(ack.snapshot);
    }
    return;
  }
  if (ack.error?.code === 'ROOM_NOT_FOUND') {
    return;
  }
  useSocketStore.setState({ error: ack.error?.message ?? '加入房间失败' });
}

function emitScreenJoin(roomCode: string): void {
  if (!socket.connected) return;
  const code = roomCode.trim();
  if (!code || code === '__pending__') return;

  socket.emit(
    'room:join',
    {
      roomCode: code,
      playerName: 'screen',
      role: 'screen',
    },
    applyScreenJoinAck,
  );
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
        socket.emit(
          'room:join',
          {
            roomCode: code,
            playerName: host.hostName || 'host',
            role: 'host',
            hostToken: host.hostToken,
          },
          applyJoinAck,
        );
      }
    } else if (nextRole === 'screen') {
      emitScreenJoin(code);
    } else if (nextRole === 'player') {
      const stored = getAuthFromLocal(code);
      if (stored) {
        socket.emit(
          'room:reconnect',
          {
            roomCode: code,
            playerId: stored.playerId,
            authToken: stored.authToken,
          },
          applyJoinAck,
        );
      }
    }
  },

  joinAsScreen: (roomCode) => {
    const code = roomCode.trim();
    if (!code || code === '__pending__') return;

    set({
      error: null,
      roomCode: code,
      role: 'screen',
    });
    ensureEventListeners();

    if (socket.connected) {
      set({ isConnected: true, isConnecting: false });
      emitScreenJoin(code);
      return;
    }

    if (!get().isConnecting) {
      set({ isConnecting: true });
      socket.connect();
    }
  },

  connect: (roomCode, role) => {
    const prev = get();
    if (prev.roomCode !== roomCode || prev.role !== role) {
      useGameStore.getState().reset();
    }

    set({
      error: null,
      roomCode,
      role,
    });
    // Always bind listeners first. The already-connected path used to
    // skip this, so a projector refresh could emit join and still miss
    // `state:sync` (empty lobby / 「已加入0人」).
    ensureEventListeners();

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
