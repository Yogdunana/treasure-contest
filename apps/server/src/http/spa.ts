import fs from 'node:fs';
import path from 'node:path';
import type { Application, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

const API_PREFIXES = ['/api', '/health', '/socket.io'];

/**
 * Whether an incoming request should skip the SPA HTML fallback.
 * REST, health, and the Socket.io handshake must keep their own handlers.
 */
export function isSpaFallbackExcluded(requestPath: string): boolean {
  return API_PREFIXES.some(
    (prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`),
  );
}

/**
 * Serve the built client and fall back to index.html for deep links
 * such as `/play/:code`, `/host/:code`, `/screen/:code`, and `/admin`.
 */
export function mountStaticAndSpa(app: Application, clientDist: string): void {
  const indexHtml = path.join(clientDist, 'index.html');

  if (!fs.existsSync(indexHtml)) {
    logger.warn('Client index.html not found; SPA fallback disabled', {
      path: indexHtml,
    });
    return;
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (isSpaFallbackExcluded(req.path)) {
      next();
      return;
    }

    const relative = req.path === '/' ? '' : req.path.replace(/^\/+/, '');
    const filePath = path.resolve(clientDist, relative);
    const isInsideDist =
      filePath === clientDist || filePath.startsWith(clientDist + path.sep);

    if (isInsideDist && relative && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.sendFile(filePath);
      return;
    }

    res.sendFile(indexHtml);
  });

  logger.info('SPA fallback enabled', { path: clientDist });
}
