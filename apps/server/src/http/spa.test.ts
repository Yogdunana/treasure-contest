import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { isSpaFallbackExcluded, mountStaticAndSpa } from './spa.js';

describe('isSpaFallbackExcluded', () => {
  it('protects API, health, and socket.io paths', () => {
    expect(isSpaFallbackExcluded('/api')).toBe(true);
    expect(isSpaFallbackExcluded('/api/admin/stats')).toBe(true);
    expect(isSpaFallbackExcluded('/health')).toBe(true);
    expect(isSpaFallbackExcluded('/socket.io')).toBe(true);
    expect(isSpaFallbackExcluded('/socket.io/?EIO=4')).toBe(true);
    expect(isSpaFallbackExcluded('/play/WS6FFD')).toBe(false);
    expect(isSpaFallbackExcluded('/host/ABC123')).toBe(false);
    expect(isSpaFallbackExcluded('/screen/ABC123')).toBe(false);
    expect(isSpaFallbackExcluded('/admin')).toBe(false);
  });
});

describe('mountStaticAndSpa', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('serves index.html for /play/:code deep links', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-spa-'));
    tmpDirs.push(dist);
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>SPA</title>');
    fs.writeFileSync(path.join(dist, 'asset.js'), 'console.log(1)');

    const app = express();
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api', (_req, res) => res.json({ name: 'api' }));
    mountStaticAndSpa(app, dist);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      const play = await fetch(`${base}/play/TESTCODE`);
      expect(play.status).toBe(200);
      expect(play.headers.get('content-type') ?? '').toMatch(/text\/html/);
      expect(await play.text()).toContain('SPA');

      const host = await fetch(`${base}/host/ABC123`);
      expect(host.status).toBe(200);
      expect(await host.text()).toContain('SPA');

      const health = await fetch(`${base}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ status: 'ok' });

      const api = await fetch(`${base}/api`);
      expect(api.status).toBe(200);
      expect(await api.json()).toEqual({ name: 'api' });

      const asset = await fetch(`${base}/asset.js`);
      expect(asset.status).toBe(200);
      expect(await asset.text()).toBe('console.log(1)');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});
