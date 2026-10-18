import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContentDraft } from '@skuf-skills/domain';
import { D1ContentRepository } from '../src/content/d1-content-repository.js';

const now = new Date('2026-10-18T07:00:00.000Z');
const term: ContentDraft = {
  type: 'term', title: 'Сигма', explanation: 'Самостоятельный человек', example: 'Настоящий сигма',
  context: 'Ироничный комплимент', tags: ['характер', 'ирония'],
};

describe('D1ContentRepository', () => {
  let miniflare: Miniflare;
  let database: D1Database;
  let repository: D1ContentRepository;

  beforeEach(async () => {
    miniflare = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      d1Databases: { DB: crypto.randomUUID() },
    });
    database = await miniflare.getD1Database('DB');
    const migration = await readFile(fileURLToPath(new URL('../migrations/0001_initial.sql', import.meta.url)), 'utf8');
    const statements = migration.split(';').map((statement) => statement.trim()).filter(Boolean);
    await database.batch(statements.map((statement) => database.prepare(statement)));
    repository = new D1ContentRepository(database);
  });

  afterEach(async () => miniflare.dispose());

  it('persists a complete pending draft and its idempotency record', async () => {
    const created = await repository.createPending({ draft: term, idempotencyKey: 'request-123', requestHash: 'hash-123', now });

    expect(created).toMatchObject({ ...term, status: 'pending', createdAt: now, updatedAt: now });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(repository.findById(created.id)).resolves.toEqual(created);
    await expect(repository.findByIdempotencyKey('request-123')).resolves.toEqual({ item: created, requestHash: 'hash-123' });
  });

  it('enforces unique idempotency keys in durable storage', async () => {
    await repository.createPending({ draft: term, idempotencyKey: 'same-key', requestHash: 'hash-a', now });

    await expect(repository.createPending({ draft: { ...term, title: 'Другой термин' }, idempotencyKey: 'same-key', requestHash: 'hash-b', now }))
      .rejects.toThrow();
  });

  it('round-trips meme media, correction snapshots and optional values', async () => {
    const draft: ContentDraft = {
      type: 'meme', title: 'Проверка', explanation: 'Описание', example: 'Пример', origin: 'Интернет',
      media: { kind: 'video', url: 'https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/' }, tags: ['видео'], author: 'Автор',
      correction: {
        targetSlug: 'old-card', changeNote: 'Уточнил',
        original: { title: term.title, explanation: term.explanation, example: term.example, tags: term.tags, context: term.context },
      },
    };

    const created = await repository.createPending({ draft, idempotencyKey: 'meme-key', requestHash: 'meme-hash', now });

    await expect(repository.findById(created.id)).resolves.toEqual(created);
  });

  it('hides non-published content and sorts moderation items newest first', async () => {
    const older = await repository.createPending({ draft: term, idempotencyKey: 'older', requestHash: 'older-hash', now });
    const newerAt = new Date(now.getTime() + 1_000);
    const newer = await repository.createPending({ draft: { ...term, title: 'Аура' }, idempotencyKey: 'newer', requestHash: 'newer-hash', now: newerAt });

    await expect(repository.listPublished()).resolves.toEqual([]);
    await expect(repository.listForAdmin({ status: 'pending' })).resolves.toEqual([newer, older]);
  });

  it('uses the expected timestamp to reject a stale moderator update', async () => {
    const created = await repository.createPending({ draft: term, idempotencyKey: 'versioned', requestHash: 'version-hash', now });
    const updatedAt = new Date(now.getTime() + 2_000);
    const updated = { ...created, title: 'Сигма 2', updatedAt };

    await expect(repository.update(updated, now)).resolves.toEqual(updated);
    await expect(repository.update({ ...updated, title: 'Устаревшая правка' }, now)).resolves.toBeNull();
  });
});
