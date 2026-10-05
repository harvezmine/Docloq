-- Collapse tenant user roles from 6 values to 3: owner / admin / user.
--   founder (earliest-created user per org) -> owner
--   legacy super_admin (tenant table)       -> owner
--   manager / auditor / viewer / user        -> user
--   admin                                    -> admin (unchanged)
-- One-time migration: enum value removal requires a type swap. Transactional.
-- (Only users.role uses the user_role enum.)

-- 1. Detach the column from the enum so we can remap freely.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE text USING "role"::text;

-- 2. Remap data. Order matters (founder -> super_admin -> catch-all).
UPDATE "users" SET "role" = 'owner'
WHERE "id" IN (
  SELECT DISTINCT ON ("organization_id") "id"
  FROM "users"
  WHERE "organization_id" IS NOT NULL
  ORDER BY "organization_id", "created_at" ASC
);
UPDATE "users" SET "role" = 'owner' WHERE "role" = 'super_admin';
UPDATE "users" SET "role" = 'user' WHERE "role" NOT IN ('owner', 'admin');

-- 3. Replace the enum type with the 3-value set.
ALTER TYPE "public"."user_role" RENAME TO "user_role_old";
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'user');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."user_role" USING "role"::"public"."user_role";
DROP TYPE "public"."user_role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
