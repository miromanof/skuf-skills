import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWorkerApp } from '../src/app.js';
import { derivePasswordKey } from '../src/auth/password.js';
import { createTestEnvironment } from './support.js';

function cookieHeader(response: Response): string {
  return response.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; ');
}

describe('Worker administrator authentication', () => {
  let cleanup: () => Promise<void>;
  let env: Awaited<ReturnType<typeof createTestEnvironment>>['env'];

  beforeEach(async () => {
    const test = await createTestEnvironment();
    env = test.env;
    env.ADMIN_PASSWORD_SALT = 'dGVzdC1zYWx0LXZhbHVl';
    env.ADMIN_PASSWORD_DERIVED_KEY = await derivePasswordKey('correct horse battery', env.ADMIN_PASSWORD_SALT);
    cleanup = () => test.miniflare.dispose();
  });
  afterEach(async () => cleanup());

  function login(password = 'correct horse battery', ip = '203.0.113.20') {
    return createWorkerApp().request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://skufskills.ru', 'cf-connecting-ip': ip },
      body: JSON.stringify({ login: env.ADMIN_LOGIN, password }),
    }, env);
  }

  it('matches a stable PBKDF2 vector and rejects a different password', async () => {
    expect(await derivePasswordKey('correct horse battery', 'dGVzdC1zYWx0LXZhbHVl')).toBe(env.ADMIN_PASSWORD_DERIVED_KEY);
    expect(await derivePasswordKey('wrong password', 'dGVzdC1zYWx0LXZhbHVl')).not.toBe(env.ADMIN_PASSWORD_DERIVED_KEY);
  });

  it('logs in with generic errors and strict production cookies', async () => {
    const wrong = await login('wrong password');
    expect(wrong.status).toBe(401);
    await expect(wrong.json()).resolves.toEqual({ error: 'Неверный логин или пароль' });

    const response = await login();
    const body = await response.json() as { authenticated: boolean; csrfToken: string };
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ authenticated: true, csrfToken: expect.any(String) });
    const cookies = response.headers.getSetCookie();
    const sessionCookie = cookies.find((value) => value.startsWith('skuf_admin_session='));
    const csrfCookie = cookies.find((value) => value.startsWith('skuf_admin_csrf='));
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('Secure');
    expect(sessionCookie).toContain('SameSite=Lax');
    expect(sessionCookie).toContain('Domain=.skufskills.ru');
    expect(csrfCookie).not.toContain('HttpOnly');
    expect(csrfCookie).toContain('Secure');
    expect(csrfCookie).toContain('SameSite=Lax');
    expect(csrfCookie).toContain('Domain=.skufskills.ru');
  });

  it('reports a valid session and requires CSRF to log out', async () => {
    const loginResponse = await login();
    const { csrfToken } = await loginResponse.clone().json() as { csrfToken: string };
    const cookie = cookieHeader(loginResponse);
    const app = createWorkerApp();

    const session = await app.request('/api/admin/session', { headers: { origin: 'https://skufskills.ru', cookie } }, env);
    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toEqual({ authenticated: true, csrfToken });

    expect((await app.request('/api/admin/logout', { method: 'POST', headers: { origin: 'https://skufskills.ru', cookie } }, env)).status).toBe(403);
    expect((await app.request('/api/admin/logout', { method: 'POST', headers: { origin: 'https://skufskills.ru', cookie, 'x-csrf-token': csrfToken } }, env)).status).toBe(204);
    expect((await app.request('/api/admin/session', { headers: { origin: 'https://skufskills.ru', cookie } }, env)).status).toBe(401);
  });

  it('rate limits repeated login failures durably', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await login('wrong password')).status).toBe(401);
    expect((await login('wrong password')).status).toBe(429);
  });

  it('does not allow administrator credentials from the GitHub preview origin', async () => {
    const response = await createWorkerApp().request('/api/admin/login', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://miromanof.github.io' },
      body: JSON.stringify({ login: env.ADMIN_LOGIN, password: 'correct horse battery' }),
    }, env);
    expect(response.status).toBe(403);
  });
});
