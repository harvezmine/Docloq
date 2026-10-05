-- Encrypted, page-attributed chunk store for AI Project sources.
--
-- Chunks are encrypted under the owning document version's DEK, so crypto-shred (which
-- nulls document_versions.encryption_key_id) renders every derived chunk unreadable with
-- no additional cleanup path to forget. Sources with no document of their own (url) carry
-- their own wrapped DEK in ai_project_sources.content_key.
--
-- content_text is deliberately NOT dropped here: the backfill reads it to chunk legacy
-- sources without re-OCR'ing scanned PDFs, and NULLs it row by row. A follow-up migration
-- drops the column once every environment has backfilled.

ALTER TABLE "ai_project_sources" ADD COLUMN IF NOT EXISTS "content_key" text;
ALTER TABLE "ai_project_sources" ADD COLUMN IF NOT EXISTS "chunk_count" integer DEFAULT 0;

-- Pins chunks to the document version whose DEK encrypted them. Every version gets a fresh
-- DEK, so resolving "latest" would fail GCM auth on every chunk as soon as a document is
-- edited (new version), leaving a source that reads healthy but cannot answer.
ALTER TABLE "ai_project_sources"
  ADD COLUMN IF NOT EXISTS "content_version_id" uuid REFERENCES "document_versions"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "ai_source_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_id" uuid NOT NULL REFERENCES "ai_project_sources"("id") ON DELETE CASCADE,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE CASCADE,
  "chunk_index" integer NOT NULL,
  "page" integer,
  "cipher_text" text NOT NULL,
  "iv" text NOT NULL,
  "auth_tag" text NOT NULL,
  "char_len" integer NOT NULL,
  "qdrant_point_id" uuid,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_src_chunk_source_idx" ON "ai_source_chunks" ("source_id", "chunk_index");
CREATE INDEX IF NOT EXISTS "ai_src_chunk_doc_idx" ON "ai_source_chunks" ("document_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_src_chunk_source_index_uniq" ON "ai_source_chunks" ("source_id", "chunk_index");
