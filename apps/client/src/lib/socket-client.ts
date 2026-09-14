/**
 * Typed Socket.io client instance.
 *
 * Exports a singleton `socket` that is pre-configured to connect to the game
 * server.  In development the Vite dev server proxies `/socket.io` to
 * `localhost:3001`; in production we connect to the same origin that served
 * the client bundle.
 *
 * The socket is typed with `ClientToServerEvents` and `ServerToClientEvents`
 * from the shared package, so all `socket.emit` and `socket.on` calls are
 * fully type-checked at compile time.
 */

import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@treasure-contest/shared';

/**
 * Determine the server URL.
 *
 * - In production (`import.meta.env.PROD`) we use the same origin (empty
 *   string tells socket.io to use `window.location.origin`).
 * - In development we point directly to the backend at `localhost:3001`.
 *   The Vite proxy handles WebSocket upgrading when needed, but connecting
 *   directly avoids any proxy-related edge cases.
 */
function getServerUrl(): string {
  if (import.meta.env.PROD) {
    return ''; // same origin
  }
  return 'http://localhost:3001';
}

/**
 * The singleton typed socket instance.
 *
 * We create the socket lazily with `autoConnect: false` so that the consumer
 * (socket-store) can register event listeners before the connection is
 * actually established.
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  getServerUrl(),
  {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  },
);

export default socket;
