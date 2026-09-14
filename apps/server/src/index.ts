import { createServer } from 'node:http';
import { config } from './config.js';
import { initDb } from './db/connection.js';
import { initDatabase } from './db/migrations.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

/**
 * Server entry point.
 *
 * Boot sequence:
 *   1. Read configuration (config.ts).
 *   2. Initialise the SQLite database + run schema migrations.
 *   3. Create the Express app and the shared HTTP server.
 *   4. Attach Socket.io to the HTTP server (with auth middleware, event handlers).
 *   5. Restore active game rooms from the DB (so in-progress games survive restarts).
 *   6. Start listening on the configured port.
 *   7. Log startup information.
 *
 * Graceful shutdown:
 *   - On SIGINT/SIGTERM, close Socket.io and the HTTP server before exiting.
 *   - A 5-second force-exit timeout prevents hanging on stuck connections.
 */
async function main(): Promise<void> {
  logger.info('Starting Treasure Contest server', {
    env: config.nodeEnv,
    port: config.port,
    dbPath: config.dbPath,
    publicUrl: config.publicUrl,
  });

  // 1 + 2. Database -------------------------------------------------------
  initDb();
  initDatabase();

  // 3 + 4. HTTP + Express + Socket.io ------------------------------------
  // The DB must be initialised before createApp() because RoomManager
  // may restore active rooms from SQLite.
  const httpServer = createServer();
  const { app, io } = createApp(httpServer, true /* restoreFromDB */);

  // Wire the Express request handler into the HTTP server.
  httpServer.on('request', app);

  // 5. Listen --------------------------------------------------------------
  httpServer.listen(config.port, () => {
    logger.info('Server listening', { port: config.port });
    logger.info('Socket.io ready', {
      publicUrl: config.publicUrl,
      corsOrigin: config.corsOrigin,
    });
  });

  // --- Graceful shutdown -------------------------------------------------
  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    io.close(() => {
      httpServer.close(() => {
        logger.info('Server closed.');
        process.exit(0);
      });
    });

    // Force-exit after 5s if graceful shutdown hangs.
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal error during server startup', err);
  process.exit(1);
});
