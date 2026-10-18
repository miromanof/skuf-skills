CREATE TABLE IF NOT EXISTS content_items (
  id uuid PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('term', 'meme')),
  status text NOT NULL CHECK (status IN ('pending', 'published', 'rejected', 'unpublished', 'deleted')),
  title text NOT NULL,
  data jsonb NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  idempotency_key text NOT NULL UNIQUE,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  moderated_at timestamptz,
  published_at timestamptz,
  rejection_reason text,
  unpublished_reason text
);
CREATE INDEX IF NOT EXISTS content_items_status_created_idx ON content_items(status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS content_items_title_lower_idx ON content_items(lower(title));

CREATE TABLE IF NOT EXISTS content_sources (
  content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  url text NOT NULL,
  verified_at date NOT NULL,
  PRIMARY KEY (content_id, url)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  csrf_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);
