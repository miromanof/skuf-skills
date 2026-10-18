import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CamelCasePlugin, Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { KyselyPGlite } from 'kysely-pglite';
import type { Database, DatabaseClient } from './types.js';

export function createDatabase(connectionString: string): DatabaseClient {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 5 }) }),
    plugins: [new CamelCasePlugin()],
  });
}

export async function createTestDatabase(): Promise<DatabaseClient> {
  const pglite = await KyselyPGlite.create();
  return new Kysely<Database>({ dialect: pglite.dialect, plugins: [new CamelCasePlugin()] });
}

export async function createLocalDatabase(path: string): Promise<DatabaseClient> {
  await mkdir(dirname(path), { recursive: true });
  const pglite = await KyselyPGlite.create(path);
  return new Kysely<Database>({ dialect: pglite.dialect, plugins: [new CamelCasePlugin()] });
}

export async function migrateDatabase(db: DatabaseClient): Promise<void> {
  const path = fileURLToPath(new URL('../migrations/001_initial.sql', import.meta.url));
  const migration = await readFile(path, 'utf8');
  for (const statement of migration.split(';').map((part) => part.trim()).filter(Boolean)) {
    await sql.raw(statement).execute(db);
  }
}
