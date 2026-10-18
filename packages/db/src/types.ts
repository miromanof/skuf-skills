import type { ColumnType, Generated, Kysely } from 'kysely';

export type Timestamp = ColumnType<Date, Date, Date>;

export interface ContentItemsTable {
  id: string;
  type: 'term' | 'meme';
  status: 'pending' | 'published' | 'rejected' | 'unpublished' | 'deleted';
  title: string;
  data: unknown;
  tags: string[];
  idempotencyKey: string;
  requestHash: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  moderatedAt: Timestamp | null;
  publishedAt: Timestamp | null;
  rejectionReason: string | null;
  unpublishedReason: string | null;
}

export interface ContentSourcesTable {
  contentId: string;
  url: string;
  verifiedAt: ColumnType<string, string, string>;
}

export interface AdminSessionsTable {
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface Database {
  contentItems: ContentItemsTable;
  contentSources: ContentSourcesTable;
  adminSessions: AdminSessionsTable;
}

export type DatabaseClient = Kysely<Database>;
