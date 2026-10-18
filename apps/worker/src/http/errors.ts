import type { Context } from 'hono';
import type { WorkerBindings } from '../env.js';

export function unavailable(context: Context<{ Bindings: WorkerBindings }>) {
  return context.json({ error: 'Сервис временно недоступен' }, 503);
}
