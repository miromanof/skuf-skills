import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWorkerApp } from '../src/app.js';
import { D1ContentRepository } from '../src/content/d1-content-repository.js';
import { createTestEnvironment, termDraft } from './support.js';

describe('Worker public content API', () => {
  let cleanup: () => Promise<void>;
  let env: Awaited<ReturnType<typeof createTestEnvironment>>['env'];
  let repository: D1ContentRepository;

  beforeEach(async () => {
    const test = await createTestEnvironment();
    env = test.env;
    repository = new D1ContentRepository(test.database);
    cleanup = () => test.miniflare.dispose();
  });
  afterEach(async () => cleanup());

  async function publish(title = termDraft.title) {
    const now = new Date('2026-10-18T00:00:00.000Z');
    const pending = await repository.createPending({ draft: { ...termDraft, title }, idempotencyKey: crypto.randomUUID(), requestHash: 'hash', now });
    const published = { ...pending, status: 'published' as const, publishedAt: now, moderatedAt: now, updatedAt: new Date(now.getTime() + 1) };
    await repository.update(published, pending.updatedAt);
    return published;
  }

  it('returns only published safe DTOs with normalized search and buckets', async () => {
    await publish();
    await repository.createPending({ draft: { ...termDraft, title: 'Секретная заявка' }, idempotencyKey: 'pending', requestHash: 'pending-hash', now: new Date() });

    const response = await createWorkerApp().request('/api/content?query=ежовый&bucket=Ё&tag=вайб', {}, env);
    const body = await response.json() as { items: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ title: 'Ёжовый вайб', bucket: 'Ё' });
    expect(body.items[0]).not.toHaveProperty('id');
    expect(body.items[0]).not.toHaveProperty('requestHash');
  });

  it('paginates with signed cursors and resolves collision-safe details', async () => {
    await publish('Аура');
    await publish('База');
    await publish('Вайб');
    const app = createWorkerApp();

    const first = await app.request('/api/content?limit=2', {}, env);
    const firstBody = await first.json() as { items: Array<{ slug: string; title: string }>; nextCursor: string };
    expect(firstBody.items.map((item) => item.title)).toEqual(['Аура', 'База']);
    expect(firstBody.nextCursor).toEqual(expect.any(String));

    const second = await app.request(`/api/content?limit=2&cursor=${encodeURIComponent(firstBody.nextCursor)}`, {}, env);
    expect((await second.json() as { items: Array<{ title: string }> }).items.map((item) => item.title)).toEqual(['Вайб']);
    expect((await app.request(`/api/content/${firstBody.items[0]!.slug}`, {}, env)).status).toBe(200);
  });

  it('rejects a tampered cursor without leaking internals', async () => {
    await publish();
    const response = await createWorkerApp().request('/api/content?cursor=forged.cursor', {}, env);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Некорректный курсор' });
  });
});
