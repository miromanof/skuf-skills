import type { FastifyInstance } from 'fastify';
import type { AuthService } from './service.js';
import { CSRF_COOKIE, SESSION_COOKIE, requireAdmin } from './require-admin.js';
import { requireCsrf } from './csrf.js';

type LoginBody = { login?: unknown; password?: unknown };
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService, options: { secureCookies: boolean; now?: () => Date }): void {
  const attempts = new Map<string, number[]>();
  const now = options.now ?? (() => new Date());
  const cookieOptions = { path: '/api/admin', sameSite: 'strict' as const, secure: options.secureCookies, maxAge: 24 * 60 * 60 };

  app.post<{ Body: LoginBody }>('/api/admin/login', async (request, reply) => {
    const timestamp = now().getTime();
    const recent = (attempts.get(request.ip) ?? []).filter((value) => timestamp - value < LOGIN_WINDOW_MS);
    if (recent.length >= LOGIN_LIMIT) return reply.code(429).send({ error: 'Слишком много попыток. Попробуйте позже' });

    const login = typeof request.body?.login === 'string' && request.body.login.length <= 320 ? request.body.login : '';
    const password = typeof request.body?.password === 'string' && request.body.password.length <= 1024 ? request.body.password : '';
    const tokens = await auth.login(login, password);
    if (!tokens) {
      recent.push(timestamp);
      attempts.set(request.ip, recent);
      return reply.code(401).send({ error: 'Неверный логин или пароль' });
    }

    attempts.delete(request.ip);
    reply.setCookie(SESSION_COOKIE, tokens.sessionToken, { ...cookieOptions, httpOnly: true });
    reply.setCookie(CSRF_COOKIE, tokens.csrfToken, { ...cookieOptions, httpOnly: false });
    return reply.send({ authenticated: true, csrfToken: tokens.csrfToken });
  });

  app.get('/api/admin/session', async (request, reply) => {
    if (!await requireAdmin(request, reply, auth)) return;
    const csrfToken = request.cookies[CSRF_COOKIE] ?? '';
    if (!await auth.verifyCsrf(request.cookies[SESSION_COOKIE] ?? '', csrfToken)) return reply.code(401).send({ error: 'Требуется вход администратора' });
    return reply.send({ authenticated: true, csrfToken });
  });

  app.post('/api/admin/logout', async (request, reply) => {
    if (!await requireAdmin(request, reply, auth)) return;
    if (!await requireCsrf(request, reply, auth)) return;
    await auth.logout(request.cookies[SESSION_COOKIE] ?? '');
    reply.clearCookie(SESSION_COOKIE, cookieOptions);
    reply.clearCookie(CSRF_COOKIE, cookieOptions);
    return reply.code(204).send();
  });
}
