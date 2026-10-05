-- Custom Roles table for organization-level role management
CREATE TABLE IF NOT EXISTS "custom_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "color" varchar(20) DEFAULT 'indigo',
  "is_active" boolean DEFAULT true,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Unique constraint: role name per organization
CREATE UNIQUE INDEX IF NOT EXISTS "custom_role_org_name_idx" ON "custom_roles" ("organization_id", "name");
CREATE INDEX IF NOT EXISTS "custom_role_org_idx" ON "custom_roles" ("organization_id");

-- Role permissions: what folders/documents a role can access
CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "role_id" uuid NOT NULL REFERENCES "custom_roles"("id") ON DELETE CASCADE,
  "resource_type" text NOT NULL,  -- 'folder' or 'document'
  "resource_id" uuid NOT NULL,
  "permission_level" text NOT NULL DEFAULT 'none',  -- 'none', 'viewer', 'editor', 'admin'
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "role_perm_role_idx" ON "role_permissions" ("role_id");
CREATE INDEX IF NOT EXISTS "role_perm_resource_idx" ON "role_permissions" ("resource_type", "resource_id");
CREATE UNIQUE INDEX IF NOT EXISTS "role_perm_unique_idx" ON "role_permissions" ("role_id", "resource_type", "resource_id");

-- User-role assignments: which users are assigned to which custom roles
CREATE TABLE IF NOT EXISTS "user_role_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "custom_roles"("id") ON DELETE CASCADE,
  "assigned_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "assigned_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_role_assign_unique_idx" ON "user_role_assignments" ("user_id", "role_id");
CREATE INDEX IF NOT EXISTS "user_role_assign_user_idx" ON "user_role_assignments" ("user_id");
CREATE INDEX IF NOT EXISTS "user_role_assign_role_idx" ON "user_role_assignments" ("role_id");
