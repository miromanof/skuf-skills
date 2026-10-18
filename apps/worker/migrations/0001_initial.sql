CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('term', 'meme')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'published', 'rejected', 'unpublished', 'deleted')),
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  data TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  moderated_at TEXT,
  published_at TEXT,
  rejection_reason TEXT,
  unpublished_reason TEXT
);

CREATE INDEX IF NOT EXISTS content_items_status_created_idx
  ON content_items(status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS content_items_normalized_title_idx
  ON content_items(normalized_title);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  csrf_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  scope TEXT NOT NULL,
  subject TEXT NOT NULL,
  count INTEGER NOT NULL,
  reset_at TEXT NOT NULL,
  PRIMARY KEY (scope, subject)
);
CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits(reset_at);
