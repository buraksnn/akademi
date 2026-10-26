import 'dotenv/config';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
if (process.env.NODE_ENV === 'production') throw new Error('Testler üretimde çalıştırılamaz.');
const source = new URL(process.env.DATABASE_URL),
  target = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
if (!process.env.TEST_DATABASE_URL) target.pathname = source.pathname + '_test';
const name = target.pathname.slice(1);
if (!/^[a-zA-Z0-9_]+_test$/.test(name))
  throw new Error('Test veritabanının adı _test ile bitmeli.');
const pool = new pg.Pool({ connectionString: source.toString() });
try {
  if (!(await pool.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount)
    await pool.query('CREATE DATABASE "' + name + '"');
} finally {
  await pool.end();
}
const env = { ...process.env, DATABASE_URL: target.toString(), NODE_ENV: 'test' };
const migration = spawnSync(
  process.execPath,
  ['--experimental-wasm-modules', 'scripts/prisma-wasm.mjs'],
  { env, stdio: 'inherit' },
);
if (migration.status) process.exit(migration.status);
const test = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.integration.config.ts'],
  { env, stdio: 'inherit' },
);
process.exit(test.status ?? 1);
