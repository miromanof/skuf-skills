import { parseContentDraft, type ContentItem, type ContentStatus } from '@skuf-skills/domain';

export type ContentRow = {
  id: string;
  type: 'term' | 'meme';
  status: ContentStatus;
  title: string;
  normalized_title: string;
  data: string;
  tags: string;
  idempotency_key: string;
  request_hash: string;
  created_at: string;
  updated_at: string;
  moderated_at: string | null;
  published_at: string | null;
  rejection_reason: string | null;
  unpublished_reason: string | null;
};

export function normalizeTitle(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim();
}

export function contentFromRow(row: ContentRow): ContentItem {
  const draft = parseContentDraft(JSON.parse(row.data));
  return {
    ...draft,
    id: row.id,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    ...(row.moderated_at ? { moderatedAt: new Date(row.moderated_at) } : {}),
    ...(row.published_at ? { publishedAt: new Date(row.published_at) } : {}),
    ...(row.rejection_reason ? { rejectionReason: row.rejection_reason } : {}),
    ...(row.unpublished_reason ? { unpublishedReason: row.unpublished_reason } : {}),
  } as ContentItem;
}

export function contentValues(item: ContentItem) {
  const { id: _id, status: _status, createdAt: _createdAt, updatedAt: _updatedAt, moderatedAt: _moderatedAt,
    publishedAt: _publishedAt, rejectionReason: _rejectionReason, unpublishedReason: _unpublishedReason, ...draft } = item;
  return {
    type: item.type,
    status: item.status,
    title: item.title,
    normalizedTitle: normalizeTitle(item.title),
    data: JSON.stringify(draft),
    tags: JSON.stringify(item.tags),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    moderatedAt: item.moderatedAt?.toISOString() ?? null,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    rejectionReason: item.rejectionReason ?? null,
    unpublishedReason: item.unpublishedReason ?? null,
  };
}
