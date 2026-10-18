import type { FastifyInstance } from 'fastify';
import { InvalidCursorError, PublicContentService, type PublicListInput } from './service.js';

type ListQuery = { type?: string; query?: string; tag?: string; bucket?: string; cursor?: string; limit?: string };

export function registerPublicContentRoutes(app: FastifyInstance, service: PublicContentService) {
  app.get<{ Querystring: ListQuery }>('/api/content', async (request, reply) => {
    const type = request.query.type;
    if (type && type !== 'term' && type !== 'meme') return reply.code(400).send({ error: 'Некорректный тип материала' });
    const contentType = type as PublicListInput['type'];
    const limit = request.query.limit === undefined ? undefined : Number(request.query.limit);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 50)) return reply.code(400).send({ error: 'Некорректный лимит' });
    try {
      const input: PublicListInput = {
        ...(contentType ? { type: contentType } : {}), ...(request.query.query ? { query: request.query.query } : {}),
        ...(request.query.tag ? { tag: request.query.tag } : {}), ...(request.query.bucket ? { bucket: request.query.bucket } : {}),
        ...(request.query.cursor ? { cursor: request.query.cursor } : {}), ...(limit ? { limit } : {}),
      };
      return await service.list(input);
    } catch (error) {
      if (error instanceof InvalidCursorError) return reply.code(400).send({ error: 'Некорректный курсор' });
      throw error;
    }
  });

  app.get<{ Params: { slug: string } }>('/api/content/:slug', async (request, reply) => {
    const item = await service.detail(request.params.slug);
    return item ?? reply.code(404).send({ error: 'Карточка не найдена' });
  });
}
