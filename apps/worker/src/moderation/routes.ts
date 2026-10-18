import { parseContentDraft, transitionContent, type ContentItem, type ContentStatus, type ModerationCommand } from '@skuf-skills/domain';
import type { Context, Hono } from 'hono';
import { ZodError } from 'zod';
import { requireSession } from '../auth/routes.js';
import { D1ContentRepository } from '../content/d1-content-repository.js';
import type { WorkerBindings } from '../env.js';

const statuses = new Set<ContentStatus>(['pending', 'published', 'rejected', 'unpublished', 'deleted']);

function dto(item: ContentItem) { return { ...item, version: item.updatedAt.toISOString() }; }

function nextUpdatedAt(item: ContentItem): Date {
  return new Date(Math.max(Date.now(), item.updatedAt.getTime() + 1));
}

async function current(repository: D1ContentRepository, id: string, version: unknown) {
  const item = await repository.findById(id);
  if (!item) return { error: 'not-found' as const };
  const expected = typeof version === 'string' ? new Date(version) : new Date(Number.NaN);
  if (Number.isNaN(expected.getTime())) return { error: 'invalid' as const };
  if (expected.getTime() !== item.updatedAt.getTime()) return { error: 'conflict' as const, item };
  return { item, expected };
}

function currentFailure(context: Context<{ Bindings: WorkerBindings }>, result: Awaited<ReturnType<typeof current>>) {
  if (result.error === 'not-found') return context.json({ error: 'Карточка не найдена' }, 404);
  if (result.error === 'invalid') return context.json({ error: 'Некорректная версия карточки' }, 400);
  return context.json({ error: 'Карточка уже изменена в другой вкладке', current: dto(result.item!) }, 409);
}

export function registerModerationRoutes(app: Hono<{ Bindings: WorkerBindings }>) {
  app.get('/api/admin/content', async (context) => {
    const authFailure = await requireSession(context);
    if (authFailure) return context.json({ error: 'Требуется вход администратора' }, authFailure);
    const status = context.req.query('status');
    if (status && !statuses.has(status as ContentStatus)) return context.json({ error: 'Неизвестный статус' }, 400);
    const items = await new D1ContentRepository(context.env.DB).listForAdmin(status ? { status: status as ContentStatus } : {});
    return context.json({ items: items.map(dto) });
  });

  app.get('/api/admin/content/:id', async (context) => {
    const authFailure = await requireSession(context);
    if (authFailure) return context.json({ error: 'Требуется вход администратора' }, authFailure);
    const item = await new D1ContentRepository(context.env.DB).findById(context.req.param('id'));
    return item ? context.json(dto(item)) : context.json({ error: 'Карточка не найдена' }, 404);
  });

  app.patch('/api/admin/content/:id', async (context) => {
    const authFailure = await requireSession(context, true);
    if (authFailure) return context.json({ error: authFailure === 403 ? 'Некорректный CSRF-токен' : 'Требуется вход администратора' }, authFailure);
    const repository = new D1ContentRepository(context.env.DB);
    const body = await context.req.json<{ version?: unknown; draft?: unknown }>().catch(() => ({} as { version?: unknown; draft?: unknown }));
    const selected = await current(repository, context.req.param('id'), body.version);
    if ('error' in selected) return currentFailure(context, selected);
    try {
      const draft = parseContentDraft(body.draft);
      if (draft.type !== selected.item.type) return context.json({ error: 'Тип карточки нельзя изменить' }, 400);
      const updated = { ...selected.item, ...draft, updatedAt: nextUpdatedAt(selected.item) };
      const saved = await repository.update(updated, selected.expected);
      return saved ? context.json(dto(saved)) : currentFailure(context, { error: 'conflict', item: (await repository.findById(selected.item.id))! });
    } catch (error) {
      if (error instanceof ZodError) return context.json({ error: 'Проверьте поля формы' }, 400);
      throw error;
    }
  });

  const transition = (action: 'publish' | 'reject' | 'unpublish') => async (context: Context<{ Bindings: WorkerBindings }>) => {
    const authFailure = await requireSession(context, true);
    if (authFailure) return context.json({ error: authFailure === 403 ? 'Некорректный CSRF-токен' : 'Требуется вход администратора' }, authFailure);
    const repository = new D1ContentRepository(context.env.DB);
    const body = await context.req.json<{ version?: unknown; reason?: unknown }>().catch(() => ({} as { version?: unknown; reason?: unknown }));
    const selected = await current(repository, context.req.param('id') ?? '', body.version);
    if ('error' in selected) return currentFailure(context, selected);
    const reason = typeof body.reason === 'string' ? body.reason : undefined;
    const command: ModerationCommand = action === 'publish' ? { type: 'publish' } : { type: action, ...(reason ? { reason } : {}) };
    try {
      const next = transitionContent(selected.item, command, nextUpdatedAt(selected.item));
      const saved = await repository.update(next, selected.expected);
      return saved ? context.json(dto(saved)) : currentFailure(context, { error: 'conflict', item: (await repository.findById(selected.item.id))! });
    } catch (error) {
      return context.json({ error: error instanceof Error ? error.message : 'Недопустимое действие' }, 409);
    }
  };

  app.post('/api/admin/content/:id/publish', transition('publish'));
  app.post('/api/admin/content/:id/reject', transition('reject'));
  app.post('/api/admin/content/:id/unpublish', transition('unpublish'));

  app.delete('/api/admin/content/:id', async (context) => {
    const authFailure = await requireSession(context, true);
    if (authFailure) return context.json({ error: authFailure === 403 ? 'Некорректный CSRF-токен' : 'Требуется вход администратора' }, authFailure);
    const repository = new D1ContentRepository(context.env.DB);
    const body = await context.req.json<{ version?: unknown }>().catch(() => ({} as { version?: unknown }));
    const selected = await current(repository, context.req.param('id'), body.version);
    if ('error' in selected) return currentFailure(context, selected);
    try {
      const deleted = transitionContent(selected.item, { type: 'delete' }, nextUpdatedAt(selected.item));
      const tombstone: ContentItem = selected.item.type === 'term'
        ? { id: selected.item.id, type: 'term', title: 'Удалено', explanation: 'Карточка удалена', example: 'Удалено', context: 'Удалено', tags: [], status: 'deleted', createdAt: selected.item.createdAt, updatedAt: deleted.updatedAt, moderatedAt: deleted.moderatedAt ?? deleted.updatedAt }
        : { id: selected.item.id, type: 'meme', title: 'Удалено', explanation: 'Карточка удалена', example: 'Удалено', origin: 'Удалено', media: { kind: 'video', url: 'https://rutube.ru/' }, tags: [], status: 'deleted', createdAt: selected.item.createdAt, updatedAt: deleted.updatedAt, moderatedAt: deleted.moderatedAt ?? deleted.updatedAt };
      const saved = await repository.update(tombstone, selected.expected);
      return saved ? context.body(null, 204) : currentFailure(context, { error: 'conflict', item: (await repository.findById(selected.item.id))! });
    } catch (error) {
      return context.json({ error: error instanceof Error ? error.message : 'Недопустимое действие' }, 409);
    }
  });
}
