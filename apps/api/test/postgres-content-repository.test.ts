import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ContentDraft } from '@skuf-skills/domain';
import { createTestDatabase, migrateDatabase, type DatabaseClient } from '@skuf-skills/db';
import { PostgresContentRepository } from '../src/adapters/postgres-content-repository.js';

let db: DatabaseClient;
let repository: PostgresContentRepository;
const draft: ContentDraft = {
  type: 'term',
  title: 'Вайб',
  explanation: 'Атмосфера.',
  example: 'Хороший вайб.',
  context: 'Неформально.',
  tags: ['общение'],
};

describe('PostgresContentRepository', () => {
  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new PostgresContentRepository(db);
    await migrateDatabase(db);
  });
  beforeEach(async () => db.deleteFrom('contentItems').execute());
  afterAll(async () => db.destroy());

  it('persists a pending item and resolves its idempotency record', async () => {
    const key = randomUUID();
    const created = await repository.createPending({ draft, idempotencyKey: key, requestHash: 'hash-1', now: new Date('2026-10-18T00:00:00Z') });

    expect(created).toMatchObject({ type: 'term', status: 'pending', title: 'Вайб' });
    await expect(repository.findById(created.id)).resolves.toMatchObject({ id: created.id });
    await expect(repository.findByIdempotencyKey(key)).resolves.toMatchObject({ requestHash: 'hash-1', item: { id: created.id } });
  });

  it('enforces unique idempotency keys', async () => {
    const key = randomUUID();
    await repository.createPending({ draft, idempotencyKey: key, requestHash: 'a', now: new Date() });
    await expect(repository.createPending({ draft, idempotencyKey: key, requestHash: 'b', now: new Date() })).rejects.toThrow();
  });

  it('never returns pending content from public queries', async () => {
    await repository.createPending({ draft, idempotencyKey: randomUUID(), requestHash: 'a', now: new Date() });
    await expect(repository.listPublished()).resolves.toEqual([]);
    await expect(repository.searchPublished('вайб')).resolves.toEqual([]);
  });

  it('filters and sorts the admin queue stably', async () => {
    await repository.createPending({ draft: { ...draft, title: 'Явление' }, idempotencyKey: randomUUID(), requestHash: 'a', now: new Date('2026-10-18T00:00:01Z') });
    await repository.createPending({ draft: { ...draft, title: 'Аура' }, idempotencyKey: randomUUID(), requestHash: 'b', now: new Date('2026-10-18T00:00:02Z') });

    const items = await repository.listForAdmin({ status: 'pending' });
    expect(items.map((item) => item.title)).toEqual(['Аура', 'Явление']);
  });
});
