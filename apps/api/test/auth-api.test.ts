import { hash } from 'argon2';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

type AdminSession = { tokenHash: string; csrfTokenHash: string; expiresAt: Date; createdAt: Date };
interface SessionStore {
  create(session: AdminSession): Promise<void>;
  find(tokenHash: string): Promise<AdminSession | null>;
  delete(tokenHash: string): Promise<void>;
}

class MemorySessionStore implements SessionStore {
  records = new Map<string, AdminSession>();
  async create(session: AdminSession) { this.records.set(session.tokenHash, session); }
  async find(tokenHash: string) { return this.records.get(tokenHash) ?? null; }
  async delete(tokenHash: string) { this.records.delete(tokenHash); }
}

function cookies(response: { headers: Record<string, string | string[] | undefined> }): string[] {
  const value = response.headers['set-cookie'];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function cookieHeader(setCookies: string[]): string {
  return setCookies.map((value) => value.split(';', 1)[0]).join('; ');
}

function cookieValue(setCookies: string[], name: string): string {
  const cookie = setCookies.find((value) => value.startsWith(`${name}=`));
  return decodeURIComponent(cookie?.split(';', 1)[0]?.slice(name.length + 1) ?? '');
}

describe('admin authentication API', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  let passwordHash: string;

  beforeAll(async () => { passwordHash = await hash('correct horse battery staple'); });
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  const setup = (options: { now?: () => Date; secureCookies?: boolean } = {}) => {
    const sessions = new MemorySessionStore();
    const app = buildApp({
      adminAuth: { login: 'admin@example.test', passwordHash, sessions, secureCookies: options.secureCookies ?? false },
      now: options.now ?? (() => new Date('2026-10-18T00:00:00Z')),
    });
    apps.push(app);
    return { app, sessions };
  };

  it('logs in with Argon2 and issues strict cookies without exposing credentials', async () => {
    const { app, sessions } = setup({ secureCookies: true });
    const response = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { login: 'admin@example.test', password: 'correct horse battery staple' } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authenticated: true, csrfToken: expect.any(String) });
    const setCookies = cookies(response);
    const sessionCookie = setCookies.find((value) => value.startsWith('skuf_admin_session='));
    const csrfCookie = setCookies.find((value) => value.startsWith('skuf_admin_csrf='));
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Strict/i);
    expect(sessionCookie).toMatch(/Secure/i);
    expect(csrfCookie).toMatch(/SameSite=Strict/i);
    expect(csrfCookie).toMatch(/Secure/i);
    expect(csrfCookie).not.toMatch(/HttpOnly/i);
    expect([...sessions.records.keys()][0]).not.toBe(cookieValue(setCookies, 'skuf_admin_session'));
    expect(response.body).not.toContain('correct horse battery staple');
    expect(response.body).not.toContain(passwordHash);
  });

  it('returns the same generic error for an unknown login and a wrong password', async () => {
    const { app } = setup();
    const unknown = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { login: 'nobody@example.test', password: 'wrong' } });
    const wrongPassword = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { login: 'admin@example.test', password: 'wrong' } });

    expect(unknown.statusCode).toBe(401);
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknown.json()).toEqual({ error: 'Неверный логин или пароль' });
    expect(wrongPassword.json()).toEqual(unknown.json());
  });

  it('reports a valid session and rejects it after expiry', async () => {
    let now = new Date('2026-10-18T00:00:00Z');
    const { app } = setup({ now: () => now });
    const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { login: 'admin@example.test', password: 'correct horse battery staple' } });
    const cookie = cookieHeader(cookies(login));

    const active = await app.inject({ method: 'GET', url: '/api/admin/session', headers: { cookie } });
    expect(active.statusCode).toBe(200);
    expect(active.json()).toEqual({ authenticated: true, csrfToken: cookieValue(cookies(login), 'skuf_admin_csrf') });

    now = new Date('2026-10-19T00:00:01Z');
    expect((await app.inject({ method: 'GET', url: '/api/admin/session', headers: { cookie } })).statusCode).toBe(401);
  });

  it('requires CSRF to log out and invalidates the server session', async () => {
    const { app } = setup();
    const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { login: 'admin@example.test', password: 'correct horse battery staple' } });
    const setCookies = cookies(login);
    const cookie = cookieHeader(setCookies);
    const csrfToken = cookieValue(setCookies, 'skuf_admin_csrf');

    expect((await app.inject({ method: 'POST', url: '/api/admin/logout', headers: { cookie } })).statusCode).toBe(403);
    const logout = await app.inject({ method: 'POST', url: '/api/admin/logout', headers: { cookie, 'x-csrf-token': csrfToken } });
    expect(logout.statusCode).toBe(204);
    expect(cookies(logout).join('\n')).toMatch(/skuf_admin_session=;.*Max-Age=0/i);
    expect((await app.inject({ method: 'GET', url: '/api/admin/session', headers: { cookie } })).statusCode).toBe(401);
  });

  it('rate limits repeated login failures from one address', async () => {
    const { app } = setup();
    let response;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { login: 'admin@example.test', password: 'wrong' } });
    }
    expect(response!.statusCode).toBe(429);
    expect(response!.json()).toEqual({ error: 'Слишком много попыток. Попробуйте позже' });
  });
});
