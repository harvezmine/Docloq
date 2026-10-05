-- Per-document toggle: embed the verification QR onto downloaded copies (PDF/DOCX).
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "qr_on_download" boolean DEFAULT false;
