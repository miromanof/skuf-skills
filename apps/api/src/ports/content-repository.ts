import type { ContentDraft, ContentItem, ContentStatus } from '@skuf-skills/domain';

export type AdminContentFilter = { status?: ContentStatus };
export type PublishedContentFilter = { type?: ContentDraft['type']; query?: string };

export interface ContentRepository {
  createPending(input: { draft: ContentDraft; idempotencyKey: string; requestHash: string; now: Date }): Promise<ContentItem>;
  findById(id: string): Promise<ContentItem | null>;
  findByIdempotencyKey(key: string): Promise<{ item: ContentItem; requestHash: string } | null>;
  listForAdmin(filter?: AdminContentFilter): Promise<ContentItem[]>;
  update(item: ContentItem, expectedUpdatedAt?: Date): Promise<ContentItem | null>;
  listPublished(filter?: PublishedContentFilter): Promise<ContentItem[]>;
  searchPublished(query: string): Promise<ContentItem[]>;
}
