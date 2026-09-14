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

  /**
   * Password required to access the admin dashboard (`/admin`).
   * In development this defaults to `admin123` for convenience.
   * In production it MUST be set via the `ADMIN_PASSWORD` environment variable.
   */
  adminPassword: process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'admin123'),

  /**
   * Secret key used to sign admin auth tokens.
   * Defaults to the admin password itself if not explicitly provided.
   */
  adminJwtSecret: process.env.ADMIN_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'dev-admin-secret',

  /**
   * Password required to create a room as a host.
   * Prevents random people on the network from creating rooms and
   * accessing the host control panel.
   * In development defaults to `host123`; in production MUST be set.
   */
  hostPassword: process.env.HOST_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'host123'),

  /**
   * Whether reconnect cookies should be marked Secure.
   * Campus HTTP deploys (e.g. http://10.100.13.17:3000) must NOT set Secure,
   * otherwise browsers silently drop the cookie. Enable only for HTTPS
   * public URLs or when COOKIE_SECURE=true.
   */
  get cookieSecure(): boolean {
    if (process.env.COOKIE_SECURE === 'true') return true;
    if (process.env.COOKIE_SECURE === 'false') return false;
    return this.publicUrl.startsWith('https://');
  },
} as const;

export type Config = typeof config;
