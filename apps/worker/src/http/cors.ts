import type { MiddlewareHandler } from 'hono';
import type { WorkerBindings } from '../env.js';

function allowedOrigins(value: string): Set<string> {
  return new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean));
}

export function explicitCors(): MiddlewareHandler<{ Bindings: WorkerBindings }> {
  return async (context, next) => {
    const origin = context.req.header('origin');
    if (origin && !allowedOrigins(context.env.ALLOWED_ORIGINS).has(origin)) return context.json({ error: 'Источник запроса не разрешён' }, 403);
    if (origin) {
      context.header('Access-Control-Allow-Origin', origin);
      context.header('Vary', 'Origin');
      context.header('Access-Control-Allow-Headers', 'content-type, idempotency-key, x-csrf-token');
      context.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      if (origin.endsWith('.skufskills.ru') || origin === 'https://skufskills.ru' || /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/u.test(origin)) {
        context.header('Access-Control-Allow-Credentials', 'true');
      }
    }
    if (context.req.method === 'OPTIONS') return context.body(null, 204);
    await next();
  };
}
