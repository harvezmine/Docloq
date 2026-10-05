-- Feature 2: hybrid post-quantum key-wrapping (X25519 + ML-KEM-768). Additive + opt-in.
-- Existing rows default to 'v1_vault' (untouched). v2 rows carry the wrap envelope.

ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "key_wrap_version" text NOT NULL DEFAULT 'v1_vault';
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "pqc_keypair_id" uuid;
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "pqc_envelope" jsonb;

-- Per-org hybrid keypair: public keys open, private keys wrapped (Vault/master key) at rest.
CREATE TABLE IF NOT EXISTS "pqc_keypairs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "kem_public_key" text NOT NULL,
  "kem_private_key_wrapped" text NOT NULL,
  "x25519_public" text NOT NULL,
  "x25519_private_wrapped" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "pqc_keypair_org_idx" ON "pqc_keypairs" ("organization_id", "is_active");
