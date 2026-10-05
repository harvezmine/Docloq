-- Manual idempotent migration: QR audit-trail (supersede + delete-survivable)
-- Apply: docker exec -i docloq_postgres psql -U user -d docloq_db < migrations/manual_qr_audit_trail.sql
-- Additive + non-destructive. Safe to re-run.

-- 1. New lifecycle + snapshot columns
ALTER TABLE document_qr_codes ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE document_qr_codes ADD COLUMN IF NOT EXISTS superseded_by_qr_id uuid;
ALTER TABLE document_qr_codes ADD COLUMN IF NOT EXISTS superseded_at timestamp;
ALTER TABLE document_qr_codes ADD COLUMN IF NOT EXISTS purged_at timestamp;
ALTER TABLE document_qr_codes ADD COLUMN IF NOT EXISTS document_version_number integer;
ALTER TABLE document_qr_codes ADD COLUMN IF NOT EXISTS content_hash_snapshot text;
ALTER TABLE document_qr_codes ADD COLUMN IF NOT EXISTS doc_name_snapshot text;

-- 2. Backfill status for existing rows (active where isActive, else superseded)
UPDATE document_qr_codes SET status = 'active' WHERE status IS NULL AND is_active = true;
UPDATE document_qr_codes SET status = 'superseded' WHERE status IS NULL AND is_active = false;

-- 3. Drop NOT NULL on FK cols (must allow NULL after document purge)
ALTER TABLE document_qr_codes ALTER COLUMN document_id DROP NOT NULL;
ALTER TABLE document_qr_codes ALTER COLUMN version_id DROP NOT NULL;

-- 4. Swap FK constraints: CASCADE -> SET NULL (QR row survives document deletion)
ALTER TABLE document_qr_codes DROP CONSTRAINT IF EXISTS document_qr_codes_document_id_documents_id_fk;
ALTER TABLE document_qr_codes ADD CONSTRAINT document_qr_codes_document_id_documents_id_fk
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

ALTER TABLE document_qr_codes DROP CONSTRAINT IF EXISTS document_qr_codes_version_id_document_versions_id_fk;
ALTER TABLE document_qr_codes ADD CONSTRAINT document_qr_codes_version_id_document_versions_id_fk
  FOREIGN KEY (version_id) REFERENCES document_versions(id) ON DELETE SET NULL;

-- 5. Index on status
CREATE INDEX IF NOT EXISTS qr_status_idx ON document_qr_codes (status);
