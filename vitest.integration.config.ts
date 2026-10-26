import { defineConfig } from 'vitest/config';
import path from 'node:path';
import 'dotenv/config';
export default defineConfig({
  resolve: { alias: { '@': path.resolve('src') } },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30000,
  },
});
