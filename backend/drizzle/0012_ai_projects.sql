-- AI Projects (NotebookLM-style): workspace + sources + chat + notes

-- 1) Project workspace
CREATE TABLE IF NOT EXISTS ai_projects (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  custom_instructions text,                       -- system prompt addendum (max 2000 char enforced di service)
  icon                text DEFAULT 'sparkles',
  color               text DEFAULT 'indigo',
  created_by          uuid NOT NULL REFERENCES users(id),
  archived_at         timestamp,
  created_at          timestamp DEFAULT now(),
  updated_at          timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_proj_org_idx ON ai_projects(organization_id);
CREATE INDEX IF NOT EXISTS ai_proj_created_by_idx ON ai_projects(created_by);

-- 2) Project sources (polymorphic: document | url | youtube)
CREATE TABLE IF NOT EXISTS ai_project_sources (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      uuid NOT NULL REFERENCES ai_projects(id) ON DELETE CASCADE,
  source_type     text NOT NULL,                   -- 'document' | 'url' | 'youtube'
  document_id     uuid REFERENCES documents(id) ON DELETE CASCADE,
  source_url      text,
  title           text NOT NULL,
  content_text    text,
  content_hash    text,
  qdrant_point_id text,
  status          text DEFAULT 'active',           -- active | processing | failed | removed
  error_message   text,
  added_by        uuid NOT NULL REFERENCES users(id),
  added_at        timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_proj_src_project_idx ON ai_project_sources(project_id);
CREATE INDEX IF NOT EXISTS ai_proj_src_doc_idx ON ai_project_sources(document_id);

-- Dedup: 1 source unik per project (kalau document_id null pakai source_url, kalau url null pakai document_id)
CREATE UNIQUE INDEX IF NOT EXISTS ai_proj_src_dedup_doc_idx
  ON ai_project_sources(project_id, document_id)
  WHERE document_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_proj_src_dedup_url_idx
  ON ai_project_sources(project_id, source_url)
  WHERE source_url IS NOT NULL;

-- 3) Chat per project
CREATE TABLE IF NOT EXISTS ai_project_chats (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid NOT NULL REFERENCES ai_projects(id) ON DELETE CASCADE,
  role        text NOT NULL,                      -- 'user' | 'assistant'
  content     text NOT NULL,
  citations   jsonb DEFAULT '[]'::jsonb,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_by  uuid REFERENCES users(id),
  created_at  timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_proj_chat_project_idx ON ai_project_chats(project_id, created_at);
CREATE INDEX IF NOT EXISTS ai_proj_chat_rate_idx ON ai_project_chats(project_id, role, created_at);

-- 4) Notes (Studio panel)
CREATE TABLE IF NOT EXISTS ai_project_notes (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id     uuid NOT NULL REFERENCES ai_projects(id) ON DELETE CASCADE,
  title          text NOT NULL,
  content        text NOT NULL,
  source_chat_id uuid REFERENCES ai_project_chats(id) ON DELETE SET NULL,
  created_by     uuid NOT NULL REFERENCES users(id),
  created_at     timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_proj_note_project_idx ON ai_project_notes(project_id);
