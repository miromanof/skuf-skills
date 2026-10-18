import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ContentDraft, ContentItem } from '@skuf-skills/domain';
import { buildApp } from '../src/app.js';
import type { ContentRepository } from '../src/ports/content-repository.js';

class MemoryRepository implements ContentRepository {
  records = new Map<string, { item: ContentItem; requestHash: string }>();
  fail = false;
  async createPending(input: { draft: ContentDraft; idempotencyKey: string; requestHash: string; now: Date }) {
    if (this.fail) throw new Error('database unavailable');
    const item = { ...input.draft, id: randomUUID(), status: 'pending' as const, createdAt: input.now, updatedAt: input.now };
    this.records.set(input.idempotencyKey, { item, requestHash: input.requestHash });
    return item;
  }
  async findById() { return null; }
  async findByIdempotencyKey(key: string) { return this.records.get(key) ?? null; }
  async listForAdmin() { return []; }
  async update(item: ContentItem) { return item; }
  async listPublished() { return []; }
  async searchPublished() { return []; }
}

const body = {
  type: 'term', title: 'Вайб', explanation: 'Атмосфера.', example: 'Хороший вайб.', context: 'Неформально.', tags: ['общение'],
};

describe('POST /api/submissions', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  const setup = () => {
    const repository = new MemoryRepository();
    const app = buildApp({ contentRepository: repository, now: () => new Date('2026-10-18T00:00:00Z') });
    apps.push(app);
    return { app, repository };
  };

  it('allows the local web preview to submit through CORS', async () => {
    const { app } = setup();
    const response = await app.inject({ method: 'OPTIONS', url: '/api/submissions', headers: { origin: 'http://127.0.0.1:5173', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,idempotency-key' } });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
  });

  it('creates a pending submission', async () => {
    const { app } = setup();
    const response = await app.inject({ method: 'POST', url: '/api/submissions', headers: { 'idempotency-key': randomUUID() }, payload: body });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ status: 'pending', submissionId: expect.any(String) });
  });

  it('returns the same submission for an identical retry', async () => {
    const { app } = setup();
    const key = randomUUID();
    const first = await app.inject({ method: 'POST', url: '/api/submissions', headers: { 'idempotency-key': key }, payload: body });
    const retry = await app.inject({ method: 'POST', url: '/api/submissions', headers: { 'idempotency-key': key }, payload: body });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());
  });

  it('rejects reuse of a key for different content', async () => {
    const { app } = setup();
    const key = randomUUID();
    await app.inject({ method: 'POST', url: '/api/submissions', headers: { 'idempotency-key': key }, payload: body });
    const response = await app.inject({ method: 'POST', url: '/api/submissions', headers: { 'idempotency-key': key }, payload: { ...body, title: 'Аура' } });
    expect(response.statusCode).toBe(409);
  });

  it('validates input and required idempotency key', async () => {
    const { app } = setup();
    expect((await app.inject({ method: 'POST', url: '/api/submissions', payload: body })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/submissions', headers: { 'idempotency-key': randomUUID() }, payload: { ...body, title: '' } })).statusCode).toBe(400);
  });

  it('returns a safe 503 when persistence fails', async () => {
    const { app, repository } = setup();
    repository.fail = true;
    const response = await app.inject({ method: 'POST', url: '/api/submissions', headers: { 'idempotency-key': randomUUID() }, payload: body });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'Сервис временно недоступен' });
  });

  it('rejects JSON bodies larger than 64 KiB', async () => {
    const { app } = setup();
    const response = await app.inject({
      method: 'POST', url: '/api/submissions', headers: { 'idempotency-key': randomUUID() },
      payload: { ...body, explanation: 'я'.repeat(70 * 1024) },
    });
    expect(response.statusCode).toBe(413);
  });

  it('rate limits repeated submissions from one address', async () => {
    const { app } = setup();
    let response;
    for (let index = 0; index < 11; index += 1) {
      response = await app.inject({ method: 'POST', url: '/api/submissions', headers: { 'idempotency-key': randomUUID() }, payload: body });
    }
    expect(response!.statusCode).toBe(429);
  });
});
