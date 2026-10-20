import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import type { WorkerBindings } from '../src/env.js';

export async function createTestEnvironment() {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { DB: crypto.randomUUID() },
  });
  const database = await miniflare.getD1Database('DB');
  const migration = await readFile(fileURLToPath(new URL('../migrations/0001_initial.sql', import.meta.url)), 'utf8');
  const statements = migration.split(';').map((statement) => statement.trim()).filter(Boolean);
  await database.batch(statements.map((statement) => database.prepare(statement)));
  const env: WorkerBindings = {
    DB: database,
    ADMIN_LOGIN: 'admin@example.com',
    ADMIN_LOGIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: '',
    ADMIN_PASSWORD_SALT: 'test-salt',
    ADMIN_PASSWORD_DERIVED_KEY: 'test-key',
    CURSOR_SECRET: 'cursor-secret-with-at-least-32-characters',
    ALLOWED_ORIGINS: 'https://skufskills.ru,https://miromanof.github.io,http://127.0.0.1:5173',
  };
  return { miniflare, database, env };
}

export const termDraft = {
  type: 'term' as const,
  title: 'Ёжовый вайб',
  explanation: 'Редкое, но меткое настроение',
  example: 'Сегодня ежовый вайб',
  context: 'Переписка',
  tags: ['вайб'],
};

