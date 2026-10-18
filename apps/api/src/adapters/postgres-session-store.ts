import type { DatabaseClient } from '@skuf-skills/db';
import type { AdminSession, SessionStore } from '../modules/auth/service.js';

export class PostgresSessionStore implements SessionStore {
  public constructor(private readonly db: DatabaseClient) {}

  async create(session: AdminSession): Promise<void> {
    await this.db.insertInto('adminSessions').values(session).execute();
  }

  async find(tokenHash: string): Promise<AdminSession | null> {
    return await this.db.selectFrom('adminSessions').selectAll().where('tokenHash', '=', tokenHash).executeTakeFirst() ?? null;
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.deleteFrom('adminSessions').where('tokenHash', '=', tokenHash).execute();
  }
}
