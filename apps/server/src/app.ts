import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server, type DefaultEventsMap } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { ClientToServerEvents, ServerToClientEvents } from '@treasure-contest/shared';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { RoomManager } from './game/room-manager.js';
import { QueueManager } from './game/queue-manager.js';
import { Broadcaster } from './socket/broadcaster.js';
import {
  authMiddleware,
  type SocketData,
  type AppServer,
} from './socket/middleware.js';
import { setupConnectionHandlers } from './socket/connection-handler.js';
import { setupActionHandlers } from './socket/action-handler.js';
import { setupHostHandlers } from './socket/host-handler.js';
import { setupQueueHandlers } from './socket/queue-handler.js';
import { createAdminRouter } from './routes/admin.js';
import { createSessionRouter } from './routes/session.js';
import { mountStaticAndSpa } from './http/spa.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create and configure the Express application with Socket.io integration.
 *
 * Boot sequence:
 * 1. Set up Express middleware (CORS, cookies, JSON parser, static files).
 * 2. Create the RoomManager (loads active rooms from DB if requested).
 * 3. Create the QueueManager and Broadcaster.
 * 4. Wire the Broadcaster's `broadcast()` as the RoomManager's `BroadcastFn`.
 * 5. Create the Socket.io server with typed events and SocketData.
 * 6. Register the auth middleware on every new connection.
 * 7. On each connection, set up all event handler groups:
 *    - Connection handlers (room:join, reconnect, leave, disconnect)
 *    - Action handlers (submit_number, select_gem)
 *    - Host handlers (create_room, start_game, pause, resume, etc.)
 *    - Queue handlers (queue:join, queue:leave)
 *
 * @param httpServer      Optional pre-created HTTP server.
 * @param restoreFromDB   Whether to restore active rooms from the DB on startup.
 * @returns The configured Express app, Socket.io server, and shared managers.
 */
export function createApp(httpServer?: HttpServer, restoreFromDB = false): {
  app: Application;
  io: AppServer;
  roomManager: RoomManager;
  queueManager: QueueManager;
  broadcaster: Broadcaster;
} {
  const app = express();

  // --- 1. Express middleware ---------------------------------------------

  // CORS: allow the client origin(s).
  const corsOptions: cors.CorsOptions = {
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  };
  app.use(cors(corsOptions));
  logger.info('CORS configured', { origin: config.corsOrigin });

  // Cookie parser: parse HTTP-only reconnect cookies (Layer 2).
  app.use(cookieParser());

  // JSON body parser for API routes.
  app.use(express.json({ limit: '1mb' }));

  // --- 2. Health check ---------------------------------------------------
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      env: config.nodeEnv,
      uptime: Math.round(process.uptime()),
    });
  });

  // --- 3. API routes placeholder -----------------------------------------
  app.get('/api', (_req, res) => {
    res.json({
      name: '@treasure-contest/server',
      version: '1.0.0',
      endpoints: ['/health', '/api', '/api/admin'],
    });
  });

  // --- 3a. Admin API routes ----------------------------------------------
  // Statistics dashboard endpoints for game data analysis.
  // Mounted before the catch-all / static file serving so these routes
  // take precedence over SPA fallback.
  app.use('/api/admin', createAdminRouter());
  app.use('/api/session', createSessionRouter());

  // --- 4. Game managers --------------------------------------------------
  // Create the RoomManager and optionally restore active rooms from the DB.
  const roomManager = new RoomManager();
  if (restoreFromDB) {
    roomManager.restoreFromDB();
  }

  // Create the QueueManager.
  const queueManager = new QueueManager();

  // --- 5. Socket.io server ----------------------------------------------
  // The Socket.io server is attached to the same HTTP server so the client
  // can connect via the same port. The fourth generic parameter (SocketData)
  // provides type-safe access to `socket.data`.
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    DefaultEventsMap,
    SocketData
  >(httpServer, {
    cors: corsOptions,
    // Allow cookies to be sent with the WebSocket handshake.
    allowEIO3: true,
  });

  // --- 6. Broadcaster + BroadcastFn --------------------------------------
  // Create the Broadcaster and wire it as the RoomManager's broadcast function.
  // When the GameEngine calls `this.broadcast()`, it calls this function,
  // which fetches all sockets in the room and sends role-filtered snapshots.
  const broadcaster = new Broadcaster(io);
  roomManager.setBroadcastFn((room) => broadcaster.broadcast(room));

  // --- 7. Auth middleware ------------------------------------------------
  // Register the auth middleware on every new connection. This parses
  // cookies from the handshake headers and attaches player ID + room code
  // to socket.data for Layer-2 cookie reconnection. Unauthenticated
  // connections are allowed through (specific event handlers enforce auth).
  io.use(authMiddleware);

  // --- 8. Connection lifecycle -------------------------------------------
  // On each new connection, register all event handler groups.
  // Each group registers its own `socket.on(...)` listeners.
  io.on('connection', (socket) => {
    logger.info('Socket connected', { id: socket.id });

    // Connection handlers: room:join, 4-layer reconnect, room:leave, disconnect
    setupConnectionHandlers(io, socket, roomManager, queueManager, broadcaster);

    // Action handlers: action:submit_number, action:select_gem
    setupActionHandlers(io, socket, roomManager, broadcaster);

    // Host handlers: create_room, start_game, pause, resume, etc.
    setupHostHandlers(io, socket, roomManager, queueManager, broadcaster);

    // Queue handlers: queue:join, queue:leave
    setupQueueHandlers(io, socket, roomManager, queueManager, broadcaster);
  });

  // --- 9. SPA fallback (production) --------------------------------------
  // Must be registered after /health, /api, and Socket.io so deep links
  // like /play/:code serve index.html instead of Express "Cannot GET".
  if (config.isProduction) {
    const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
    mountStaticAndSpa(app, clientDist);
  }

  return { app, io, roomManager, queueManager, broadcaster };
}
