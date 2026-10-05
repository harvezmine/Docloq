-- Manual idempotent migration: verification_requests FKs → ON DELETE SET NULL
-- Apply: docker exec -i infra-postgres-1 psql -U docloq -d docloq_db < migrations/manual_verification_fk_setnull.sql
--
-- Why: verification_requests is an audit trail. Its FKs to documents / document_versions /
-- blockchain_anchors defaulted to RESTRICT, which BLOCKS permanent deletion of a document
-- that was ever verified (Trash → permanent delete failed). SET NULL lets the document be
-- purged while the audit record survives (matched ids become NULL).
-- Constraint names are truncated by Postgres at 63 chars — these match the live DB.

ALTER TABLE verification_requests DROP CONSTRAINT IF EXISTS verification_requests_matched_document_id_documents_id_fk;
ALTER TABLE verification_requests ADD CONSTRAINT verification_requests_matched_document_id_documents_id_fk
  FOREIGN KEY (matched_document_id) REFERENCES documents(id) ON DELETE SET NULL;

ALTER TABLE verification_requests DROP CONSTRAINT IF EXISTS verification_requests_matched_version_id_document_versions_id_f;
ALTER TABLE verification_requests ADD CONSTRAINT verification_requests_matched_version_id_document_versions_id_f
  FOREIGN KEY (matched_version_id) REFERENCES document_versions(id) ON DELETE SET NULL;

ALTER TABLE verification_requests DROP CONSTRAINT IF EXISTS verification_requests_blockchain_anchor_id_blockchain_anchors_i;
ALTER TABLE verification_requests ADD CONSTRAINT verification_requests_blockchain_anchor_id_blockchain_anchors_i
  FOREIGN KEY (blockchain_anchor_id) REFERENCES blockchain_anchors(id) ON DELETE SET NULL;
