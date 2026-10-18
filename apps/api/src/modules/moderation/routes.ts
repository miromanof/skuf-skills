import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ContentStatus, ModerationCommand } from '@skuf-skills/domain';
import type { AuthService } from '../auth/service.js';
import { requireAdmin } from '../auth/require-admin.js';
import { requireCsrf } from '../auth/csrf.js';
import { adminContentDto, InvalidModerationError, ModerationService, NotFoundError, StateConflictError, VersionConflictError } from './service.js';

const statuses = new Set<ContentStatus>(['pending', 'published', 'rejected', 'unpublished', 'deleted']);

async function authorized(request: FastifyRequest, reply: FastifyReply, auth: AuthService, mutating = false): Promise<boolean> {
  if (!await requireAdmin(request, reply, auth)) return false;
  return !mutating || await requireCsrf(request, reply, auth);
}

function failure(reply: FastifyReply, error: unknown) {
  if (error instanceof NotFoundError) return reply.code(404).send({ error: error.message });
  if (error instanceof VersionConflictError) return reply.code(409).send({ error: error.message, current: adminContentDto(error.current) });
  if (error instanceof StateConflictError) return reply.code(409).send({ error: error.message });
  if (error instanceof InvalidModerationError || error instanceof Error && error.name === 'ZodError') return reply.code(400).send({ error: error.message });
  throw error;
}

export function registerModerationRoutes(app: FastifyInstance, service: ModerationService, auth: AuthService): void {
  app.get<{ Querystring: { status?: string } }>('/api/admin/content', async (request, reply) => {
    if (!await authorized(request, reply, auth)) return;
    const status = request.query.status;
    if (status && !statuses.has(status as ContentStatus)) return reply.code(400).send({ error: 'Неизвестный статус' });
    const items = await service.list(status as ContentStatus | undefined);
    return reply.send({ items: items.map(adminContentDto) });
  });

  app.get<{ Params: { id: string } }>('/api/admin/content/:id', async (request, reply) => {
    if (!await authorized(request, reply, auth)) return;
    try { return reply.send(adminContentDto(await service.get(request.params.id))); } catch (error) { return failure(reply, error); }
  });

  app.patch<{ Params: { id: string }; Body: { version?: unknown; draft?: unknown } }>('/api/admin/content/:id', async (request, reply) => {
    if (!await authorized(request, reply, auth, true)) return;
    try {
      return reply.send(adminContentDto(await service.edit(request.params.id, typeof request.body?.version === 'string' ? request.body.version : '', request.body?.draft)));
    } catch (error) { return failure(reply, error); }
  });

  const transition = (action: 'publish' | 'reject' | 'unpublish') => async (request: FastifyRequest<{ Params: { id: string }; Body: { version?: unknown; reason?: unknown } }>, reply: FastifyReply) => {
    if (!await authorized(request, reply, auth, true)) return;
    const version = typeof request.body?.version === 'string' ? request.body.version : '';
    const reason = typeof request.body?.reason === 'string' ? request.body.reason : undefined;
    const command: ModerationCommand = action === 'publish' ? { type: 'publish' } : { type: action, ...(reason ? { reason } : {}) };
    try { return reply.send(adminContentDto(await service.transition(request.params.id, version, command))); } catch (error) { return failure(reply, error); }
  };

  app.post('/api/admin/content/:id/publish', transition('publish'));
  app.post('/api/admin/content/:id/reject', transition('reject'));
  app.post('/api/admin/content/:id/unpublish', transition('unpublish'));

  app.delete<{ Params: { id: string }; Body: { version?: unknown } }>('/api/admin/content/:id', async (request, reply) => {
    if (!await authorized(request, reply, auth, true)) return;
    try {
      await service.delete(request.params.id, typeof request.body?.version === 'string' ? request.body.version : '');
      return reply.code(204).send();
    } catch (error) { return failure(reply, error); }
  });
}
