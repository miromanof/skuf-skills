import { createDatabase, migrateDatabase } from './migrate.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const db = createDatabase(databaseUrl);
try {
  await migrateDatabase(db);
} finally {
  await db.destroy();
}
