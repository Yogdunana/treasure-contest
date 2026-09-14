import { getDb } from './connection.js';
import { SCHEMA_SQL } from './schema.js';
import { logger } from '../utils/logger.js';

/**
 * Initialise the database schema.
 *
 * This is intentionally simple — the schema is idempotent (all statements
 * use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`), so it
 * can be run on every startup without data loss.
 *
 * If real migrations become necessary later they can be layered on top
 * (e.g. a `schema_version` table with ordered migration scripts).
 */
export function initDatabase(): void {
  const db = getDb();

  db.exec(SCHEMA_SQL);
  logger.info('Database schema initialised (all tables and indexes ready).');
}
