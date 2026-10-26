// Official Prisma schema engine alternative for environments without native engine downloads.
import 'dotenv/config';
import { SchemaEngine } from '@prisma/schema-engine-wasm';
import { PrismaPg } from '@prisma/adapter-pg';
import { bindMigrationAwareSqlAdapterFactory } from '@prisma/driver-adapter-utils';
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const factory = new PrismaPg(pool);
  const connect = factory.connect.bind(factory);
  factory.connect = async () => {
    const adapter = await connect();
    adapter.executeScript = async (script) => {
      const client = await pool.connect();
      try {
        await client.query(script);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    };
    return adapter;
  };
  const engine = await SchemaEngine.new(
    { datamodels: [['schema.prisma', schema]] },
    () => {},
    bindMigrationAwareSqlAdapterFactory(factory),
  );
  const baseDir = 'prisma/migrations';
  const migrationDirectories = readdirSync(baseDir, { withFileTypes: true })
    .filter((v) => v.isDirectory())
    .map((v) => ({
      path: v.name,
      migrationFile: {
        path: 'migration.sql',
        content: {
          tag: 'ok',
          value: readFileSync(baseDir + '/' + v.name + '/migration.sql', 'utf8'),
        },
      },
    }));
  const result = await engine.applyMigrations({
    migrationsList: {
      baseDir,
      shadowDbInitScript: '',
      lockfile: {
        path: 'migration_lock.toml',
        content: readFileSync(baseDir + '/migration_lock.toml', 'utf8'),
      },
      migrationDirectories,
    },
    filters: { externalTables: [], externalEnums: [] },
  });
  console.log('Prisma migrations applied:', result.appliedMigrationNames.length);
  engine.free();
} finally {
  await pool.end();
}
