/**
 * useSocket — React hook for managing the Socket.io connection lifecycle.
 *
 * Wraps the socket-store so that React components can reactively observe
 * the connection status.  The hook also handles automatic cleanup on
 * component unmount.
 *
 * @returns Connection status, error message, and the raw connect/disconnect
 *          functions from the socket store.
 */

import { useCallback } from 'react';
import { useSocketStore } from '../store/socket-store';
import type { ClientRole } from '@treasure-contest/shared';

export interface UseSocketReturn {
  /** Whether the socket is currently connected to the server. */
  isConnected: boolean;
  /** Whether a connection attempt is in progress. */
  isConnecting: boolean;
  /** Error message if the last connection attempt failed, otherwise null. */
  error: string | null;
  /** The room code the socket is associated with (if connected). */
  roomCode: string | null;
  /** The client role the socket is associated with (if connected). */
  role: ClientRole | null;
  /** Opens a socket connection and registers event listeners. */
  connect: (roomCode: string, role: ClientRole) => void;
  /** Closes the socket connection and cleans up listeners. */
  disconnect: () => void;
  /** Clears the current error state. */
  clearError: () => void;
}

export function useSocket(): UseSocketReturn {
  const isConnected = useSocketStore((s) => s.isConnected);
  const isConnecting = useSocketStore((s) => s.isConnecting);
  const error = useSocketStore((s) => s.error);
  const roomCode = useSocketStore((s) => s.roomCode);
  const role = useSocketStore((s) => s.role);
  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);
  const clearError = useSocketStore((s) => s.clearError);

  const handleConnect = useCallback(
    (code: string, clientRole: ClientRole) => {
      connect(code, clientRole);
    },
    [connect],
  );

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    roomCode,
    role,
    connect: handleConnect,
    disconnect: handleDisconnect,
    clearError,
  };
}

export default useSocket;
