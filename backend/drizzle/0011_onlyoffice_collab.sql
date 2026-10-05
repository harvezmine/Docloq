-- OnlyOffice collaboration: edit lock + threaded comments + presence tracking

-- 1) Edit lock on documents (2h absolute, single editor at a time)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS edit_locked_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS edit_lock_acquired_at timestamp;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS edit_lock_expires_at timestamp;

CREATE INDEX IF NOT EXISTS doc_lock_expires_idx ON documents(edit_lock_expires_at);

-- 2) Threaded comments (with @mention payload)
CREATE TABLE IF NOT EXISTS document_comments (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id         uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  author_id           uuid NOT NULL REFERENCES users(id),
  content             text NOT NULL,
  mentions            jsonb DEFAULT '[]'::jsonb,
  parent_comment_id   uuid REFERENCES document_comments(id) ON DELETE CASCADE,
  edited_at           timestamp,
  deleted_at          timestamp,
  created_at          timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doc_comment_doc_idx ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS doc_comment_parent_idx ON document_comments(parent_comment_id);

-- 3) Ephemeral presence (heartbeat-based, stale rows masked by query filter)
CREATE TABLE IF NOT EXISTS document_presence (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id        uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode               text NOT NULL,                       -- 'view' | 'edit'
  last_heartbeat_at  timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS doc_presence_unique_idx ON document_presence(document_id, user_id);
CREATE INDEX IF NOT EXISTS doc_presence_heartbeat_idx ON document_presence(document_id, last_heartbeat_at);
