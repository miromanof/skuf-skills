import { parseContentDraft } from '@skuf-skills/domain';
import type { Context, Hono } from 'hono';
import { ZodError } from 'zod';
import type { WorkerBindings } from '../env.js';
import { sha256Hex } from '../security/crypto.js';
import { D1ContentRepository } from './d1-content-repository.js';

const WINDOW_MS = 60_000;

async function exceedsRateLimit(context: Context<{ Bindings: WorkerBindings }>): Promise<boolean> {
  const subject = context.req.header('cf-connecting-ip') ?? 'unknown';
  const now = new Date();
  const resetAt = new Date(now.getTime() + WINDOW_MS).toISOString();
  const nowIso = now.toISOString();
  const row = await context.env.DB.prepare(`INSERT INTO rate_limits (scope, subject, count, reset_at) VALUES ('submission', ?, 1, ?)
    ON CONFLICT(scope, subject) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
    RETURNING count`).bind(subject, resetAt, nowIso, nowIso).first<{ count: number }>();
  return (row?.count ?? 1) > 10;
}

export function registerSubmissionRoutes(app: Hono<{ Bindings: WorkerBindings }>) {
  app.post('/api/submissions', async (context) => {
    try {
      if (await exceedsRateLimit(context)) return context.json({ error: 'Слишком много попыток. Попробуйте позже' }, 429);
      const key = context.req.header('idempotency-key');
      if (!key || key.length < 8 || key.length > 200) return context.json({ error: 'Нужен корректный Idempotency-Key' }, 400);
      const rawBody = await context.req.raw.text();
      if (new TextEncoder().encode(rawBody).byteLength > 64 * 1024) return context.json({ error: 'Слишком большой запрос' }, 413);
      const draft = parseContentDraft(JSON.parse(rawBody));
      const hash = await sha256Hex(JSON.stringify(draft));
      const repository = new D1ContentRepository(context.env.DB);
      const existing = await repository.findByIdempotencyKey(key);
      if (existing) {
        if (existing.requestHash !== hash) return context.json({ error: 'Этот ключ уже использован для другой заявки' }, 409);
        return context.json({ submissionId: existing.item.id, status: 'pending' as const }, 200);
      }
      try {
        const item = await repository.createPending({ draft, idempotencyKey: key, requestHash: hash, now: new Date() });
        return context.json({ submissionId: item.id, status: 'pending' as const }, 201);
      } catch {
        const raced = await repository.findByIdempotencyKey(key);
        if (raced?.requestHash === hash) return context.json({ submissionId: raced.item.id, status: 'pending' as const }, 200);
        throw new Error('submission-persistence');
      }
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) return context.json({ error: 'Проверьте поля формы' }, 400);
      return context.json({ error: 'Сервис временно недоступен' }, 503);
    }
  });
}
