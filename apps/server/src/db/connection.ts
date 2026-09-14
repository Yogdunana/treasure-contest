import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/** Singleton database instance (lives for the lifetime of the process). */
let dbInstance: DatabaseType | null = null;

/**
 * Initialise the SQLite database connection.
 *
 * - Creates the data directory if it does not exist (so first-run works).
 * - Opens the database file in WAL mode for better concurrent-read performance.
 * - Enables foreign-key enforcement so cascading deletes work correctly.
 *
 * @returns The shared `better-sqlite3` Database instance.
 */
export function initDb(): DatabaseType {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = config.dbPath;
  const dbDir = path.dirname(dbPath);

  // Create the data directory tree if it doesn't exist.
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info(`Created database directory: ${dbDir}`);
  }

  const db = new Database(dbPath);

  // WAL mode allows multiple readers alongside a single writer, which suits
  // the single-process, many-read access pattern of the game server.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');

  dbInstance = db;
  logger.info(`SQLite database initialised at ${dbPath} (WAL mode)`);

  return db;
}

/**
 * Get the shared database instance.
 *
 * @throws If the database has not yet been initialised via {@link initDb}.
 */
export function getDb(): DatabaseType {
  if (!dbInstance) {
    throw new Error('Database not initialised. Call initDb() first.');
  }
  return dbInstance;
}

/**
 * Close the database connection cleanly (used in tests and shutdown hooks).
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    logger.info('SQLite database connection closed.');
  }
}
