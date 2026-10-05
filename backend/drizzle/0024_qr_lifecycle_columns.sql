-- Bring document_qr_codes in line with src/db/schema.js — document upload was
-- hard-broken without this.
--
-- document_qr_codes has only ever been created by 0000_goofy_magma.sql. The
-- Drizzle schema later grew a QR lifecycle (status/supersede/purge) plus three
-- issue-time snapshot columns, but no migration was ever written for them, so
-- the table on any DB built purely from drizzle/*.sql is seven columns short of
-- what the code inserts. The upload pipeline's step 9 therefore failed on every
-- single upload with
--   Failed query: insert into "document_qr_codes" (... "status",
--   "superseded_by_qr_id", "superseded_at", "purged_at",
--   "document_version_number", "content_hash_snapshot", "doc_name_snapshot" ...)
-- and, because QR generation is inside the upload transaction, no document could
-- be stored at all. A fresh deploy of this repo could not accept a single file.
--
-- This went unnoticed because the previous production database had the columns
-- applied out-of-band (drizzle-kit push, or by hand) rather than through a
-- migration, so the gap only became visible when the DB was rebuilt from the
-- migration files alone.
--
-- A full `drizzle-orm` introspection of all 69 tables declared in schema.js
-- found this to be the only drifted table, so this migration closes the whole
-- gap rather than one symptom of it.
--
-- Two deliberate constraint changes, both matching what schema.js already says:
--
--   * document_id / version_id become NULLABLE and their foreign keys move from
--     ON DELETE CASCADE to ON DELETE SET NULL. schema.js is explicit about why:
--     "SET NULL (not cascade): QR row survives document purge to act as audit
--     trail." Under CASCADE, purging a document silently deleted the evidence
--     that its QR was ever issued, which defeats the point of the snapshot
--     columns added below — they exist precisely so a QR stays auditable after
--     the document is gone. Widening NOT NULL to NULL cannot invalidate an
--     existing row.
--
--   * status defaults to 'active', matching schema.js, so rows written by any
--     older code path are classified correctly rather than left NULL.
--
-- Backfill: existing rows get status from is_active, and a NULL snapshot set.
-- Snapshots cannot be reconstructed retroactively for rows whose document has
-- already been deleted, which is exactly the data loss the CASCADE above caused;
-- for surviving documents the columns are left NULL rather than guessed, since a
-- fabricated snapshot would be worse than an absent one in an audit trail.

ALTER TABLE "document_qr_codes"
  ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "superseded_by_qr_id" uuid,
  ADD COLUMN IF NOT EXISTS "superseded_at" timestamp,
  ADD COLUMN IF NOT EXISTS "purged_at" timestamp,
  ADD COLUMN IF NOT EXISTS "document_version_number" integer,
  ADD COLUMN IF NOT EXISTS "content_hash_snapshot" text,
  ADD COLUMN IF NOT EXISTS "doc_name_snapshot" text;

-- Classify any pre-existing rows instead of leaving status NULL.
UPDATE "document_qr_codes"
   SET "status" = CASE WHEN "is_active" IS FALSE THEN 'revoked' ELSE 'active' END
 WHERE "status" IS NULL;

ALTER TABLE "document_qr_codes" ALTER COLUMN "document_id" DROP NOT NULL;
ALTER TABLE "document_qr_codes" ALTER COLUMN "version_id"  DROP NOT NULL;

-- Re-point both FKs at SET NULL so a purged document leaves its QR audit row.
ALTER TABLE "document_qr_codes"
  DROP CONSTRAINT IF EXISTS "document_qr_codes_document_id_documents_id_fk";
ALTER TABLE "document_qr_codes"
  ADD CONSTRAINT "document_qr_codes_document_id_documents_id_fk"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL;

ALTER TABLE "document_qr_codes"
  DROP CONSTRAINT IF EXISTS "document_qr_codes_version_id_document_versions_id_fk";
ALTER TABLE "document_qr_codes"
  ADD CONSTRAINT "document_qr_codes_version_id_document_versions_id_fk"
  FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "qr_status_idx" ON "document_qr_codes" ("status");
