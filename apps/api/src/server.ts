import { buildApp } from './app.js';
import { createDatabase, createLocalDatabase, migrateDatabase } from '@skuf-skills/db';
import { PostgresContentRepository } from './adapters/postgres-content-repository.js';
import { PostgresSessionStore } from './adapters/postgres-session-store.js';
import { loadLocalEnvironment } from './local-env.js';

loadLocalEnvironment();

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const host = process.env.HOST ?? '127.0.0.1';
const database = process.env.DATABASE_URL
  ? createDatabase(process.env.DATABASE_URL)
  : await createLocalDatabase(process.env.LOCAL_DATABASE_PATH ?? '.data/skuf-skills-db');
await migrateDatabase(database);
const adminAuth = process.env.ADMIN_LOGIN && process.env.ADMIN_PASSWORD_HASH ? {
  login: process.env.ADMIN_LOGIN,
  passwordHash: process.env.ADMIN_PASSWORD_HASH,
  sessions: new PostgresSessionStore(database),
  secureCookies: process.env.NODE_ENV === 'production',
} : undefined;
const app = buildApp({
  contentRepository: new PostgresContentRepository(database),
  ...(adminAuth ? { adminAuth } : {}),
  ...(process.env.PUBLIC_CURSOR_SECRET ? { publicCursorSecret: process.env.PUBLIC_CURSOR_SECRET } : {}),
});

app.addHook('onClose', async () => database.destroy());

await app.listen({ port, host });
