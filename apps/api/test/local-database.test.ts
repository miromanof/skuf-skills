import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalDatabase, migrateDatabase } from '@skuf-skills/db';
import { PostgresContentRepository } from '../src/adapters/postgres-content-repository.js';

const roots: string[] = [];

describe('local database', () => {
  afterEach(async () => Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

  it('keeps moderation submissions after reopening the local server database', async () => {
    const root = `.data/test-local-db-${randomUUID()}`;
    const path = `${root}/database`;
    roots.push(root);
    const key = randomUUID();
    const first = await createLocalDatabase(path);
    await migrateDatabase(first);
    await new PostgresContentRepository(first).createPending({
      draft: { type: 'term', title: 'Слей', explanation: 'Значение.', example: 'Пример.', context: 'Контекст.', tags: [], correction: { targetSlug: 'slay', changeNote: 'Уточнил.' } },
      idempotencyKey: key,
      requestHash: 'hash',
      now: new Date('2026-10-18T00:00:00Z'),
    });
    await first.destroy();

    const reopened = await createLocalDatabase(path);
    await expect(new PostgresContentRepository(reopened).findByIdempotencyKey(key)).resolves.toMatchObject({ item: { status: 'pending', correction: { targetSlug: 'slay' } } });
    await reopened.destroy();
  });
});
