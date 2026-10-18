import type { ContentDraft, ContentItem } from '@skuf-skills/domain';
import { contentFromRow, contentValues, normalizeTitle, type ContentRow } from './serialization.js';
import type { AdminContentFilter, ContentRepository } from './types.js';

export class D1ContentRepository implements ContentRepository {
  constructor(private readonly database: D1Database) {}

  async createPending(input: { draft: ContentDraft; idempotencyKey: string; requestHash: string; now: Date }): Promise<ContentItem> {
    const item = { ...input.draft, id: crypto.randomUUID(), status: 'pending' as const, createdAt: input.now, updatedAt: input.now };
    const values = contentValues(item);
    await this.database.prepare(`INSERT INTO content_items
      (id, type, status, title, normalized_title, data, tags, idempotency_key, request_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(item.id, values.type, values.status, values.title, values.normalizedTitle, values.data, values.tags,
        input.idempotencyKey, input.requestHash, values.createdAt, values.updatedAt).run();
    return item;
  }

  async findById(id: string): Promise<ContentItem | null> {
    const row = await this.database.prepare('SELECT * FROM content_items WHERE id = ?').bind(id).first<ContentRow>();
    return row ? contentFromRow(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<{ item: ContentItem; requestHash: string } | null> {
    const row = await this.database.prepare('SELECT * FROM content_items WHERE idempotency_key = ?').bind(key).first<ContentRow>();
    return row ? { item: contentFromRow(row), requestHash: row.request_hash } : null;
  }

  async listForAdmin(filter: AdminContentFilter = {}): Promise<ContentItem[]> {
    const statement = filter.status
      ? this.database.prepare('SELECT * FROM content_items WHERE status = ? ORDER BY created_at DESC, id DESC').bind(filter.status)
      : this.database.prepare('SELECT * FROM content_items ORDER BY created_at DESC, id DESC');
    const result = await statement.all<ContentRow>();
    return result.results.map(contentFromRow);
  }

  async update(item: ContentItem, expectedUpdatedAt?: Date): Promise<ContentItem | null> {
    const values = contentValues(item);
    const expected = expectedUpdatedAt?.toISOString();
    const statement = this.database.prepare(`UPDATE content_items SET
      type = ?, status = ?, title = ?, normalized_title = ?, data = ?, tags = ?, updated_at = ?, moderated_at = ?,
      published_at = ?, rejection_reason = ?, unpublished_reason = ?
      WHERE id = ?${expected ? ' AND updated_at = ?' : ''}`);
    const bindings: unknown[] = [values.type, values.status, values.title, values.normalizedTitle, values.data, values.tags,
      values.updatedAt, values.moderatedAt, values.publishedAt, values.rejectionReason, values.unpublishedReason, item.id];
    if (expected) bindings.push(expected);
    const result = await statement.bind(...bindings).run();
    return result.meta.changes === 1 ? item : null;
  }

  async listPublished(): Promise<ContentItem[]> {
    const result = await this.database.prepare("SELECT * FROM content_items WHERE status = 'published' ORDER BY normalized_title, id").all<ContentRow>();
    return result.results.map(contentFromRow);
  }

  async searchPublished(query: string): Promise<ContentItem[]> {
    const normalized = normalizeTitle(query);
    return (await this.listPublished()).filter((item) =>
      [item.title, item.explanation, ...item.tags].some((value) => normalizeTitle(value).includes(normalized)));
  }
}
