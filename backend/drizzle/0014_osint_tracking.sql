-- OSINT Document Tracking: per-document tracking toggle + visible canary code.
--   documents.tracking_enabled        -> toggle (owner or creator)
--   documents.tracking_code           -> stable per-doc discovery code (docCode)
--   download_watermarks.visible_code  -> full visible code stamped on a given download
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tracking_enabled" boolean DEFAULT false;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tracking_code" text;
ALTER TABLE "download_watermarks" ADD COLUMN IF NOT EXISTS "visible_code" text;
