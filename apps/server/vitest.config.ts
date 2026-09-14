import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const dbPath = path.join(os.tmpdir(), `treasure-test-${process.pid}.db`);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DB_PATH: dbPath,
      HOST_PASSWORD: 'host123',
    },
  },
});
