export type AdminSession = { tokenHash: string; csrfTokenHash: string; expiresAt: Date; createdAt: Date };

type SessionRow = { token_hash: string; csrf_token_hash: string; expires_at: string; created_at: string };

export class D1SessionStore {
  constructor(private readonly database: D1Database) {}

  async create(session: AdminSession): Promise<void> {
    await this.database.prepare(`INSERT INTO admin_sessions (token_hash, csrf_token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?)`)
      .bind(session.tokenHash, session.csrfTokenHash, session.expiresAt.toISOString(), session.createdAt.toISOString()).run();
  }

  async find(tokenHash: string): Promise<AdminSession | null> {
    const row = await this.database.prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).first<SessionRow>();
    return row ? { tokenHash: row.token_hash, csrfTokenHash: row.csrf_token_hash, expiresAt: new Date(row.expires_at), createdAt: new Date(row.created_at) } : null;
  }

  async delete(tokenHash: string): Promise<void> {
    await this.database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
  }
}
