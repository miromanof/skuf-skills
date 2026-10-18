import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from './service.js';
import { CSRF_COOKIE, SESSION_COOKIE } from './require-admin.js';

export async function requireCsrf(request: FastifyRequest, reply: FastifyReply, auth: AuthService): Promise<boolean> {
  const header = request.headers['x-csrf-token'];
  const csrfToken = typeof header === 'string' ? header : '';
  const cookieToken = request.cookies[CSRF_COOKIE] ?? '';
  const valid = csrfToken === cookieToken && await auth.verifyCsrf(request.cookies[SESSION_COOKIE] ?? '', csrfToken);
  if (!valid) await reply.code(403).send({ error: 'Недействительный CSRF-токен' });
  return valid;
}
