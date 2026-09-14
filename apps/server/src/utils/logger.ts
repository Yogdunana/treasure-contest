/**
 * Lightweight structured logger with timestamp, level and optional data.
 *
 * Designed to be simple and dependency-free — no external logging library.
 * Each call produces a single line on stdout/stderr making it easy to scan
 * or pipe into a log aggregator.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: ' INFO',
  warn: ' WARN',
  error: 'ERROR',
};

/** Minimum log level that will be emitted. Controlled via NODE_ENV. */
const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug';

/**
 * Core log function.
 *
 * @param level   Severity level.
 * @param message Human-readable message.
 * @param data     Optional structured data appended to the log line.
 */
export function log(level: LogLevel, message: string, data?: unknown): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) {
    return;
  }

  const timestamp = new Date().toISOString();
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;

  const base = `[${timestamp}] [${LEVEL_LABEL[level]}] ${message}`;

  if (data !== undefined) {
    const dataStr = typeof data === 'string' ? data : safeStringify(data);
    stream.write(`${base} ${dataStr}\n`);
  } else {
    stream.write(`${base}\n`);
  }
}

/** Safe JSON stringify that never throws on circular references. */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Convenience bound methods. */
export const logger = {
  debug: (message: string, data?: unknown) => log('debug', message, data),
  info: (message: string, data?: unknown) => log('info', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data),
  error: (message: string, data?: unknown) => log('error', message, data),
};
