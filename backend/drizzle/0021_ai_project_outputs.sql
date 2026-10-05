-- Generated Studio outputs, encrypted at rest.
--
-- Outputs derive from MANY sources, so unlike ai_source_chunks they cannot be keyed to a
-- single document DEK and therefore do NOT inherit crypto-shred. ai_projects.content_key is a
-- project-level DEK; erasing outputs when their sources are erased is explicit application
-- code (eraseOutputsForSource / eraseOutputsForDocument), not a property of the key.
--
-- cipher_text encrypts content AND citations together: citations embed `quote`, which is
-- document text, and a plain jsonb column would leak it — the exact hole 0019 closed.

ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "content_key" text;

CREATE TABLE IF NOT EXISTS "ai_project_outputs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "ai_projects"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "cipher_text" text,
  "iv" text,
  "auth_tag" text,
  "char_len" integer DEFAULT 0,
  "source_ids" jsonb DEFAULT '[]'::jsonb,
  "model" text,
  "prompt_tokens" integer DEFAULT 0,
  "completion_tokens" integer DEFAULT 0,
  "status" text DEFAULT 'generating',
  "error_message" text,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_proj_out_project_idx" ON "ai_project_outputs" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_proj_out_kind_idx" ON "ai_project_outputs" ("project_id", "kind");
