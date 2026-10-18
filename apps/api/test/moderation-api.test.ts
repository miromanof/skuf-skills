import { randomUUID } from 'node:crypto';
import { hash } from 'argon2';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ContentDraft, ContentItem } from '@skuf-skills/domain';
import { buildApp } from '../src/app.js';
import type { ContentRepository } from '../src/ports/content-repository.js';
import type { FileStorage } from '../src/ports/file-storage.js';
import type { AdminSession, SessionStore } from '../src/modules/auth/service.js';

class MemorySessions implements SessionStore {
  records = new Map<string, AdminSession>();
  async create(session: AdminSession) { this.records.set(session.tokenHash, session); }
  async find(tokenHash: string) { return this.records.get(tokenHash) ?? null; }
  async delete(tokenHash: string) { this.records.delete(tokenHash); }
}

class MemoryContentRepository implements ContentRepository {
  records = new Map<string, ContentItem>();
  async createPending() { throw new Error('unused'); }
  async findById(id: string) { return this.records.get(id) ?? null; }
  async findByIdempotencyKey() { return null; }
  async listForAdmin(filter: { status?: ContentItem['status'] } = {}) { return [...this.records.values()].filter((item) => !filter.status || item.status === filter.status); }
  async update(item: ContentItem, expectedUpdatedAt?: Date) {
    const current = this.records.get(item.id);
    if (!current || expectedUpdatedAt && current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return null;
    this.records.set(item.id, item);
    return item;
  }
  async listPublished() { return [...this.records.values()].filter((item) => item.status === 'published'); }
  async searchPublished() { return this.listPublished(); }
}

class MemoryFileStorage implements FileStorage {
  deleted: string[] = [];
  async saveValidatedImage() { throw new Error('unused'); }
  async delete(storageKey: string) { this.deleted.push(storageKey); }
}

const termDraft: ContentDraft = { type: 'term', title: 'Вайб', explanation: 'Атмосфера.', example: 'Хороший вайб.', context: 'Неформально.', tags: ['общение'] };
const now = new Date('2026-10-18T00:00:00Z');

function cookieValues(response: { headers: Record<string, string | string[] | undefined> }) {
  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const header = cookies.map((value) => value.split(';', 1)[0]).join('; ');
  const csrf = decodeURIComponent(cookies.find((value) => value.startsWith('skuf_admin_csrf='))?.split(';', 1)[0]?.slice('skuf_admin_csrf='.length) ?? '');
  return { cookie: header, csrf };
}

describe('moderation API', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  let passwordHash: string;
  beforeAll(async () => { passwordHash = await hash('moderator password'); });
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  const setup = async (item: ContentItem = { ...termDraft, id: randomUUID(), status: 'pending', createdAt: now, updatedAt: now }) => {
    const repository = new MemoryContentRepository();
    const files = new MemoryFileStorage();
    repository.records.set(item.id, item);
    const app = buildApp({
      contentRepository: repository,
      fileStorage: files,
      adminAuth: { login: 'admin@example.test', passwordHash, sessions: new MemorySessions(), secureCookies: false },
      now: () => now,
    });
    apps.push(app);
    const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { login: 'admin@example.test', password: 'moderator password' } });
    return { app, repository, files, item, ...cookieValues(login) };
  };

  it('protects the queue and lists only the requested status', async () => {
    const { app, cookie } = await setup();
    expect((await app.inject({ method: 'GET', url: '/api/admin/content' })).statusCode).toBe(401);
    const response = await app.inject({ method: 'GET', url: '/api/admin/content?status=pending', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ items: [{ title: 'Вайб', status: 'pending', version: now.toISOString() }] });
  });

  it('requires CSRF and revalidates edited content', async () => {
    const { app, cookie, csrf, item } = await setup();
    const validDraft = { ...termDraft, explanation: 'Общее настроение.' };
    expect((await app.inject({ method: 'PATCH', url: `/api/admin/content/${item.id}`, headers: { cookie }, payload: { version: now.toISOString(), draft: validDraft } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `/api/admin/content/${item.id}`, headers: { cookie, 'x-csrf-token': csrf }, payload: { version: now.toISOString(), draft: { ...validDraft, title: '' } } })).statusCode).toBe(400);
    const updated = await app.inject({ method: 'PATCH', url: `/api/admin/content/${item.id}`, headers: { cookie, 'x-csrf-token': csrf }, payload: { version: now.toISOString(), draft: validDraft } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ explanation: 'Общее настроение.' });
  });

  it('returns the current item for an optimistic version conflict', async () => {
    const { app, cookie, csrf, item, repository } = await setup();
    repository.records.set(item.id, { ...item, updatedAt: new Date('2026-10-18T00:00:01Z') });
    const response = await app.inject({ method: 'PATCH', url: `/api/admin/content/${item.id}`, headers: { cookie, 'x-csrf-token': csrf }, payload: { version: now.toISOString(), draft: termDraft } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: expect.stringMatching(/другой вкладке/i), current: { version: '2026-10-18T00:00:01.000Z' } });
  });

  it('publishes, rejects with a reason and blocks invalid transitions', async () => {
    const { app, cookie, csrf, item } = await setup();
    const headers = { cookie, 'x-csrf-token': csrf };
    const published = await app.inject({ method: 'POST', url: `/api/admin/content/${item.id}/publish`, headers, payload: { version: now.toISOString() } });
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ status: 'published' });
    expect((await app.inject({ method: 'POST', url: `/api/admin/content/${item.id}/publish`, headers, payload: { version: now.toISOString() } })).statusCode).toBe(409);

    const second = { ...item, id: randomUUID() };
    const other = await setup(second);
    expect((await other.app.inject({ method: 'POST', url: `/api/admin/content/${second.id}/reject`, headers: { cookie: other.cookie, 'x-csrf-token': other.csrf }, payload: { version: now.toISOString() } })).statusCode).toBe(400);
  });

  it('creates an anonymized tombstone before deleting the associated image', async () => {
    const meme: ContentItem = {
      type: 'meme', title: 'Мем', explanation: 'Описание.', example: 'Пример.', origin: 'Источник.', tags: [],
      media: { kind: 'image', uploadToken: 'safe-image.png' }, id: randomUUID(), status: 'published', createdAt: now, updatedAt: now,
    };
    const { app, cookie, csrf, files, repository } = await setup(meme);
    const response = await app.inject({ method: 'DELETE', url: `/api/admin/content/${meme.id}`, headers: { cookie, 'x-csrf-token': csrf }, payload: { version: now.toISOString() } });
    expect(response.statusCode).toBe(204);
    expect(repository.records.get(meme.id)).toMatchObject({ id: meme.id, status: 'deleted', title: 'Удалено' });
    expect(JSON.stringify(repository.records.get(meme.id))).not.toContain('Описание.');
    expect(files.deleted).toEqual(['safe-image.png']);
  });
});
