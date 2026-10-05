-- Make crypto-shredding physically possible.
--
-- cryptoShred() (archive.service.js) destroys a document's DEK by nulling the columns that
-- hold it — that nulling IS the GDPR Art. 17 erasure primitive. But encryption_key_id,
-- encryption_iv and encryption_salt were all declared NOT NULL, so the UPDATE raised
--   null value in column "encryption_key_id" violates not-null constraint
-- and the whole shred aborted. The function is fail-closed, so it never claimed a false
-- success — it simply could never succeed. It has no production callers today, so nothing
-- has silently mis-erased; it would have thrown the moment it was wired to a route.
--
-- A destroyed key is legitimately absent, so NULL is the correct representation. Readers
-- already treat a missing key as "undecryptable" and fail closed:
--   encryption.service.js  unwrapVersionKey()  -> throws when encryptionKeyId is absent
--   ai-analysis.service.js decryptDocument()   -> guards on `authTag && version.encryptionKeyId`
--
-- Relaxing NOT NULL cannot invalidate any existing row.

ALTER TABLE "document_versions" ALTER COLUMN "encryption_key_id" DROP NOT NULL;
ALTER TABLE "document_versions" ALTER COLUMN "encryption_iv" DROP NOT NULL;
ALTER TABLE "document_versions" ALTER COLUMN "encryption_salt" DROP NOT NULL;
