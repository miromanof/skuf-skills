import { describe, expect, it } from 'vitest';
import type { ContentItem } from '@skuf-skills/domain';
import { buildApp } from '../src/app.js';
import type { ContentRepository, PublishedContentFilter } from '../src/ports/content-repository.js';

const now = new Date('2026-10-18T00:00:00.000Z');
const term = (overrides: Partial<ContentItem> = {}): ContentItem => ({
  id: 'public-1', type: 'term', status: 'published', title: 'Ёжовый вайб',
  explanation: 'Редкое, но меткое настроение', example: 'Сегодня ежовый вайб', context: 'Переписка',
  tags: ['вайб'], createdAt: now, updatedAt: now, publishedAt: now, ...overrides,
});

class MemoryRepository implements ContentRepository {
  constructor(private readonly items: ContentItem[]) {}
  async createPending() { throw new Error('unused'); }
  async findById(id: string) { return this.items.find((item) => item.id === id) ?? null; }
  async findByIdempotencyKey() { return null; }
  async listForAdmin() { return this.items; }
  async update() { return null; }
  async listPublished(_filter: PublishedContentFilter = {}) { return this.items.filter((item) => item.status === 'published'); }
  async searchPublished() { return this.listPublished(); }
}

describe('public content API', () => {
  it('returns only published safe DTOs and supports normalized search and buckets', async () => {
    const repository = new MemoryRepository([
      term(),
      term({ id: 'pending-1', status: 'pending', title: 'Секретная заявка', rejectionReason: 'internal' }),
    ]);
    const app = buildApp({ contentRepository: repository, publicCursorSecret: 'test-secret' });

    const response = await app.inject({ method: 'GET', url: '/api/content?query=ежовый&bucket=Ё&tag=вайб' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ slug: 'ezhovyi-vaib-public-1', title: 'Ёжовый вайб', bucket: 'Ё' });
    expect(body.items[0]).not.toHaveProperty('id');
    expect(body.items[0]).not.toHaveProperty('rejectionReason');
    await app.close();
  });

  it('uses stable collision-safe slugs and hides every non-public status', async () => {
    const repository = new MemoryRepository([
      term({ id: 'aaa11111', title: 'Вайб' }), term({ id: 'bbb22222', title: 'Вайб' }),
      ...(['pending', 'rejected', 'unpublished', 'deleted'] as const).map((status, index) => term({ id: `hidden-${index}`, title: `Hidden ${index}`, status })),
    ]);
    const app = buildApp({ contentRepository: repository, publicCursorSecret: 'test-secret' });

    const list = (await app.inject({ method: 'GET', url: '/api/content' })).json();
    expect(list.items.map((item: { slug: string }) => item.slug)).toEqual(['vaib-aaa11111', 'vaib-bbb22222']);
    for (const slug of ['hidden-0', 'hidden-1', 'hidden-2', 'hidden-3']) {
      expect((await app.inject({ method: 'GET', url: `/api/content/${slug}` })).statusCode).toBe(404);
    }
    await app.close();
  });

  it('paginates with an opaque cursor and resolves a published detail', async () => {
    const repository = new MemoryRepository([term({ id: 'a1111111', title: 'Аура' }), term({ id: 'b2222222', title: 'База' }), term({ id: 'v3333333', title: 'Вайб' })]);
    const app = buildApp({ contentRepository: repository, publicCursorSecret: 'test-secret' });

    const first = (await app.inject({ method: 'GET', url: '/api/content?limit=2' })).json();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.nextCursor).not.toContain('База');
    const second = (await app.inject({ method: 'GET', url: `/api/content?limit=2&cursor=${encodeURIComponent(first.nextCursor)}` })).json();
    expect(second.items.map((item: { title: string }) => item.title)).toEqual(['Вайб']);
    const detail = await app.inject({ method: 'GET', url: `/api/content/${first.items[0].slug}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ title: 'Аура' });
    await app.close();
  });

  it('rejects a tampered cursor without leaking internals', async () => {
    const app = buildApp({ contentRepository: new MemoryRepository([term()]), publicCursorSecret: 'test-secret' });
    const response = await app.inject({ method: 'GET', url: '/api/content?cursor=forged.cursor' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Некорректный курсор' });
    await app.close();
  });
});
