import { randomUUID } from 'node:crypto';
import type { ContentDraft, ContentItem } from '@skuf-skills/domain';
import { sql, type Selectable } from 'kysely';
import type { ContentItemsTable, DatabaseClient } from '@skuf-skills/db';
import type { AdminContentFilter, ContentRepository, PublishedContentFilter } from '../ports/content-repository.js';

function rowToItem(row: Selectable<ContentItemsTable>): ContentItem {
  const draft = row.data as ContentDraft;
  return {
    ...draft,
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.moderatedAt ? { moderatedAt: row.moderatedAt } : {}),
    ...(row.publishedAt ? { publishedAt: row.publishedAt } : {}),
    ...(row.rejectionReason ? { rejectionReason: row.rejectionReason } : {}),
    ...(row.unpublishedReason ? { unpublishedReason: row.unpublishedReason } : {}),
  };
}

export class PostgresContentRepository implements ContentRepository {
  public constructor(private readonly db: DatabaseClient) {}

  async createPending(input: { draft: ContentDraft; idempotencyKey: string; requestHash: string; now: Date }): Promise<ContentItem> {
    const row = await this.db.insertInto('contentItems').values({
      id: randomUUID(), type: input.draft.type, status: 'pending', title: input.draft.title,
      data: input.draft, tags: input.draft.tags, idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash, createdAt: input.now, updatedAt: input.now,
      moderatedAt: null, publishedAt: null, rejectionReason: null, unpublishedReason: null,
    }).returningAll().executeTakeFirstOrThrow();
    return rowToItem(row);
  }

  async findById(id: string): Promise<ContentItem | null> {
    const row = await this.db.selectFrom('contentItems').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? rowToItem(row) : null;
  }

  async findByIdempotencyKey(key: string) {
    const row = await this.db.selectFrom('contentItems').selectAll().where('idempotencyKey', '=', key).executeTakeFirst();
    return row ? { item: rowToItem(row), requestHash: row.requestHash } : null;
  }

  async listForAdmin(filter: AdminContentFilter = {}): Promise<ContentItem[]> {
    let query = this.db.selectFrom('contentItems').selectAll();
    if (filter.status) query = query.where('status', '=', filter.status);
    return (await query.orderBy('createdAt', 'desc').orderBy('id', 'desc').execute()).map(rowToItem);
  }

  async update(item: ContentItem, expectedUpdatedAt?: Date): Promise<ContentItem | null> {
    let query = this.db.updateTable('contentItems').set({
      status: item.status, title: item.title, data: item, tags: item.tags,
      updatedAt: item.updatedAt, moderatedAt: item.moderatedAt ?? null, publishedAt: item.publishedAt ?? null,
      rejectionReason: item.rejectionReason ?? null, unpublishedReason: item.unpublishedReason ?? null,
    }).where('id', '=', item.id);
    if (expectedUpdatedAt) query = query.where('updatedAt', '=', expectedUpdatedAt);
    const row = await query.returningAll().executeTakeFirst();
    return row ? rowToItem(row) : null;
  }

  async listPublished(filter: PublishedContentFilter = {}): Promise<ContentItem[]> {
    let query = this.db.selectFrom('contentItems').selectAll().where('status', '=', 'published');
    if (filter.type) query = query.where('type', '=', filter.type);
    if (filter.query) query = query.where('title', 'ilike', `%${filter.query}%`);
    return (await query.orderBy('title').orderBy('id').execute()).map(rowToItem);
  }

  async searchPublished(query: string): Promise<ContentItem[]> {
    const pattern = `%${query}%`;
    const rows = await this.db.selectFrom('contentItems').selectAll().where('status', '=', 'published').where((eb) =>
      eb.or([
        eb('title', 'ilike', pattern),
        sql<boolean>`${sql.ref('data')}->>'explanation' ILIKE ${pattern}`,
        sql<boolean>`${query} = ANY(${sql.ref('tags')})`,
      ]),
    ).orderBy('title').orderBy('id').execute();
    return rows.map(rowToItem);
  }
}
