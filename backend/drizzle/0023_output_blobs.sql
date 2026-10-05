-- Encrypted image blobs for Studio image outputs (mind map, infographic, slide cover).
-- The blob lives in R2 under ai-outputs/<projectId>/<outputId>.png.enc, encrypted with the
-- project DEK — the SAME erasure story as a text output's cipher_text.
ALTER TABLE "ai_project_outputs" ADD COLUMN IF NOT EXISTS "blob_key" text;
ALTER TABLE "ai_project_outputs" ADD COLUMN IF NOT EXISTS "blob_iv" text;
ALTER TABLE "ai_project_outputs" ADD COLUMN IF NOT EXISTS "blob_auth_tag" text;
ALTER TABLE "ai_project_outputs" ADD COLUMN IF NOT EXISTS "blob_mime" text;
ALTER TABLE "ai_project_outputs" ADD COLUMN IF NOT EXISTS "instructions" text;
