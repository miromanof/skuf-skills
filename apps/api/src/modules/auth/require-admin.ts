import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService, AdminSession } from './service.js';

export const SESSION_COOKIE = 'skuf_admin_session';
export const CSRF_COOKIE = 'skuf_admin_csrf';

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply, auth: AuthService): Promise<AdminSession | null> {
  const session = await auth.session(request.cookies[SESSION_COOKIE] ?? '');
  if (!session) {
    await reply.code(401).send({ error: 'Требуется вход администратора' });
    return null;
  }
  return session;
}
