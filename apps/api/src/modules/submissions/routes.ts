import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { IdempotencyConflictError, SubmissionService } from './service.js';

export async function registerSubmissionRoutes(app: FastifyInstance, service: SubmissionService) {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  app.post('/api/submissions', async (request, reply) => {
    const now = Date.now();
    const current = attempts.get(request.ip);
    const entry = !current || current.resetAt <= now ? { count: 1, resetAt: now + 60_000 } : { ...current, count: current.count + 1 };
    attempts.set(request.ip, entry);
    if (entry.count > 10) return reply.code(429).send({ error: 'Слишком много попыток. Попробуйте позже' });

    const key = request.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length < 8 || key.length > 200) {
      return reply.code(400).send({ error: 'Нужен корректный Idempotency-Key' });
    }
    try {
      const result = await service.submit(request.body, key);
      return reply.code(result.created ? 201 : 200).send({ submissionId: result.item.id, status: 'pending' });
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: 'Проверьте поля формы' });
      if (error instanceof IdempotencyConflictError) return reply.code(409).send({ error: 'Этот ключ уже использован для другой заявки' });
      request.log.error({ err: error }, 'submission persistence failed');
      return reply.code(503).send({ error: 'Сервис временно недоступен' });
    }
  });
}
