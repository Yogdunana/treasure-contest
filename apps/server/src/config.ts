import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Centralised environment configuration for the server.
 *
 * All values are read from environment variables with sensible defaults so the
 * server can run out-of-the-box in development while remaining fully
 * configurable for production deployments.
 */
export const config = {
  /** HTTP port the Express + Socket.io server listens on. */
  port: Number(process.env.PORT ?? (process.env.NODE_ENV === 'production' ? 3000 : 3001)),

  /** Filesystem path for the SQLite database file. */
  dbPath: process.env.DB_PATH ?? path.resolve(__dirname, '..', 'data', 'treasure.db'),

  /** Comma-separated list of allowed CORS origins, or `true` to allow all. */
  corsOrigin: process.env.CORS_ORIGIN ?? '*',

  /**
   * Public base URL used when generating QR codes for room joins.
   * e.g. `https://treasure.example.com` -> QR encodes `${PUBLIC_URL}/#/join/CODE`
   */
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${Number(process.env.PORT ?? 3001)}`,

  /** Standard Node environment flag: `development` | `production` | `test`. */
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',

  /** True when running in production mode. */
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
} as const;

export type Config = typeof config;
