-- Tier 3: per-document redaction consent, provenance receipts, project sharing.

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "ai_redaction_mode" text;
ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "share_link_token" text;
ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "share_link_enabled" boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS "ai_project_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "ai_projects"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending',
  "source" text DEFAULT 'invite',
  "invited_by" uuid REFERENCES "users"("id"),
  "invited_at" timestamp DEFAULT now(),
  "responded_at" timestamp
);
CREATE INDEX IF NOT EXISTS "ai_proj_member_project_idx" ON "ai_project_members" ("project_id");
CREATE INDEX IF NOT EXISTS "ai_proj_member_user_idx" ON "ai_project_members" ("user_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_proj_member_uniq" ON "ai_project_members" ("project_id", "user_id");

-- Hashes only. Source content never lands here.
CREATE TABLE IF NOT EXISTS "ai_provenance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "ai_projects"("id") ON DELETE CASCADE,
  "subject_type" text NOT NULL,
  "subject_id" uuid NOT NULL,
  "answer_hash" text NOT NULL,
  "prompt_hash" text NOT NULL,
  "source_fingerprints" jsonb DEFAULT '[]'::jsonb,
  "model" text,
  "redaction_modes" jsonb DEFAULT '{}'::jsonb,
  "audit_log_id" uuid,
  "entry_hash" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_prov_subject_idx" ON "ai_provenance" ("subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "ai_prov_project_idx" ON "ai_provenance" ("project_id");

-- Already-granted documents predate the choice; they were granted with no redaction, which is
-- exactly what 'full' means. Nothing is re-ingested.
UPDATE "documents" SET "ai_redaction_mode" = 'full'
  WHERE "ai_access_granted" = true AND "ai_redaction_mode" IS NULL;
