import type { Context, Hono, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { WorkerBindings } from '../env.js';
import { sha256Hex, secureEqual } from '../security/crypto.js';
import { verifyPassword } from './password.js';
import { D1SessionStore } from './session-store.js';

export const SESSION_COOKIE = 'skuf_admin_session';
export const CSRF_COOKIE = 'skuf_admin_csrf';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function isAdminOrigin(origin: string): boolean {
  return origin === 'https://skufskills.ru' || origin === 'https://www.skufskills.ru' || /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/u.test(origin);
}

export function requireAdminOrigin(): MiddlewareHandler<{ Bindings: WorkerBindings }> {
  return async (context, next) => {
    const origin = context.req.header('origin') ?? '';
    if (!isAdminOrigin(origin)) return context.json({ error: 'Источник запроса не разрешён' }, 403);
    await next();
  };
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function cookieOptions(context: Context<{ Bindings: WorkerBindings }>, httpOnly: boolean) {
  const local = (context.req.header('origin') ?? '').startsWith('http://');
  return {
    path: '/api/admin', maxAge: 24 * 60 * 60, httpOnly, secure: !local, sameSite: 'Lax' as const,
    ...(!local ? { domain: '.skufskills.ru' } : {}),
  };
}

async function session(context: Context<{ Bindings: WorkerBindings }>) {
  const token = getCookie(context, SESSION_COOKIE) ?? '';
  if (!token) return null;
  const hash = await sha256Hex(token);
  const store = new D1SessionStore(context.env.DB);
  const found = await store.find(hash);
  if (!found) return null;
  if (found.expiresAt.getTime() <= Date.now()) { await store.delete(hash); return null; }
  return { token, found, store };
}

export async function requireSession(context: Context<{ Bindings: WorkerBindings }>, mutating = false): Promise<401 | 403 | null> {
  const active = await session(context);
  if (!active) return 401;
  if (mutating) {
    const csrf = context.req.header('x-csrf-token') ?? '';
    if (!csrf || !secureEqual(await sha256Hex(csrf), active.found.csrfTokenHash)) return 403;
  }
  return null;
}

async function loginAttempt(database: D1Database, subject: string): Promise<number> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + LOGIN_WINDOW_MS).toISOString();
  const nowIso = now.toISOString();
  const row = await database.prepare(`INSERT INTO rate_limits (scope, subject, count, reset_at) VALUES ('login', ?, 1, ?)
    ON CONFLICT(scope, subject) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
    RETURNING count`).bind(subject, resetAt, nowIso, nowIso).first<{ count: number }>();
  return row?.count ?? 1;
}

export function registerAuthRoutes(app: Hono<{ Bindings: WorkerBindings }>) {
  app.post('/api/admin/login', async (context) => {
    const body = await context.req.json<{ login?: unknown; password?: unknown }>().catch(() => ({} as { login?: unknown; password?: unknown }));
    const login = typeof body.login === 'string' && body.login.length <= 320 ? body.login : '';
    const password = typeof body.password === 'string' && body.password.length <= 1024 ? body.password : '';
    const subject = context.req.header('cf-connecting-ip') ?? 'unknown';
    const attempts = await loginAttempt(context.env.DB, subject);
    if (attempts > 5) return context.json({ error: 'Слишком много попыток. Попробуйте позже' }, 429);
    if (login !== context.env.ADMIN_LOGIN || !await verifyPassword(password, context.env.ADMIN_PASSWORD_SALT, context.env.ADMIN_PASSWORD_DERIVED_KEY)) {
      return context.json({ error: 'Неверный логин или пароль' }, 401);
    }
    await context.env.DB.prepare("DELETE FROM rate_limits WHERE scope = 'login' AND subject = ?").bind(subject).run();
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    await new D1SessionStore(context.env.DB).create({
      tokenHash: await sha256Hex(sessionToken), csrfTokenHash: await sha256Hex(csrfToken), createdAt, expiresAt,
    });
    setCookie(context, SESSION_COOKIE, sessionToken, cookieOptions(context, true));
    setCookie(context, CSRF_COOKIE, csrfToken, cookieOptions(context, false));
    return context.json({ authenticated: true, csrfToken });
  });

  app.get('/api/admin/session', async (context) => {
    const active = await session(context);
    const csrfToken = getCookie(context, CSRF_COOKIE) ?? '';
    if (!active || !csrfToken || !secureEqual(await sha256Hex(csrfToken), active.found.csrfTokenHash)) {
      return context.json({ error: 'Требуется вход администратора' }, 401);
    }
    return context.json({ authenticated: true, csrfToken });
  });

  app.post('/api/admin/logout', async (context) => {
    const active = await session(context);
    if (!active) return context.json({ error: 'Требуется вход администратора' }, 401);
    const csrf = context.req.header('x-csrf-token') ?? '';
    if (!csrf || !secureEqual(await sha256Hex(csrf), active.found.csrfTokenHash)) return context.json({ error: 'Некорректный CSRF-токен' }, 403);
    await active.store.delete(await sha256Hex(active.token));
    deleteCookie(context, SESSION_COOKIE, cookieOptions(context, true));
    deleteCookie(context, CSRF_COOKIE, cookieOptions(context, false));
    return context.body(null, 204);
  });
}
