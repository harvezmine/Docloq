-- Tamper-evident audit log (Feature 1): per-organization hash chain + periodic
-- blockchain anchoring. All additive + backward-compatible.
--   audit_logs.sequence_number / prev_hash / entry_hash  -> per-org hash chain fields
--                                                            (NULL for pre-cutover rows)
--   audit_chain_head      -> fast append target + per-org serialization lock (SELECT FOR UPDATE)
--   audit_chain_anchors   -> record of each Merkle root anchored on-chain (fromSeq..toSeq)
--
-- Old rows keep NULL chain fields; the verifier starts the chain at the first row
-- that has a non-null sequence_number (the migration cutover point).

-- 1. Hash-chain columns on the existing audit log (nullable for old rows).
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "sequence_number" bigint;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "prev_hash" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entry_hash" text;

-- Ordered scan per org for verification + uniqueness of (org, seq) to forbid forks/dupes.
CREATE UNIQUE INDEX IF NOT EXISTS "audit_org_seq_uq"
  ON "audit_logs" ("organization_id", "sequence_number");

-- 2. Per-org chain head: holds the latest seq + hash; also the row we lock on append.
CREATE TABLE IF NOT EXISTS "audit_chain_head" (
  "organization_id" uuid PRIMARY KEY REFERENCES "organizations"("id"),
  "last_seq" bigint NOT NULL DEFAULT 0,
  "last_hash" text NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
  "updated_at" timestamp DEFAULT now()
);

-- 3. On-chain anchor records: one row per anchored batch (Merkle root over a seq range).
CREATE TABLE IF NOT EXISTS "audit_chain_anchors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid REFERENCES "organizations"("id"),
  "from_seq" bigint NOT NULL,
  "to_seq" bigint NOT NULL,
  "entry_count" integer NOT NULL,
  "root_hash" text NOT NULL,
  "blockchain_tx_hash" text,
  "block_number" bigint,
  "status" text DEFAULT 'pending',
  "anchored_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_anchor_org_idx"
  ON "audit_chain_anchors" ("organization_id", "to_seq");
