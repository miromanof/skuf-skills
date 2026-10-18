import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { verify } from 'argon2';

export type AdminSession = {
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export interface SessionStore {
  create(session: AdminSession): Promise<void>;
  find(tokenHash: string): Promise<AdminSession | null>;
  delete(tokenHash: string): Promise<void>;
}

export type AuthTokens = { sessionToken: string; csrfToken: string; expiresAt: Date };

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export class AuthService {
  public constructor(
    private readonly adminLogin: string,
    private readonly passwordHash: string,
    private readonly sessions: SessionStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login(login: string, password: string): Promise<AuthTokens | null> {
    let passwordMatches = false;
    try {
      passwordMatches = await verify(this.passwordHash, password);
    } catch {
      passwordMatches = false;
    }
    if (login !== this.adminLogin || !passwordMatches) return null;

    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    const sessionToken = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    await this.sessions.create({ tokenHash: tokenHash(sessionToken), csrfTokenHash: tokenHash(csrfToken), createdAt, expiresAt });
    return { sessionToken, csrfToken, expiresAt };
  }

  async session(sessionToken: string): Promise<AdminSession | null> {
    if (!sessionToken) return null;
    const hash = tokenHash(sessionToken);
    const session = await this.sessions.find(hash);
    if (!session) return null;
    if (session.expiresAt.getTime() <= this.now().getTime()) {
      await this.sessions.delete(hash);
      return null;
    }
    return session;
  }

  async verifyCsrf(sessionToken: string, csrfToken: string): Promise<boolean> {
    const session = await this.session(sessionToken);
    return Boolean(session && csrfToken && hashesMatch(session.csrfTokenHash, tokenHash(csrfToken)));
  }

  async logout(sessionToken: string): Promise<void> {
    if (sessionToken) await this.sessions.delete(tokenHash(sessionToken));
  }
}
