CREATE TABLE "ai_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"monthly_analysis_limit" integer DEFAULT 100,
	"monthly_pages_limit" integer DEFAULT 500,
	"analysis_used_this_month" integer DEFAULT 0,
	"pages_used_this_month" integer DEFAULT 0,
	"current_period_start" timestamp DEFAULT now(),
	"current_period_end" timestamp,
	"total_analyses_all_time" integer DEFAULT 0,
	"total_pages_all_time" integer DEFAULT 0,
	"total_tokens_all_time" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" varchar(20) DEFAULT 'indigo',
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "download_watermarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"downloaded_by" uuid,
	"watermark_id" text NOT NULL,
	"watermark_token" text NOT NULL,
	"watermark_positions" jsonb,
	"payload_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"document_format" text,
	"watermark_method" text DEFAULT 'unicode_invisible',
	"ip_address" text,
	"user_agent" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "download_watermarks_watermark_id_unique" UNIQUE("watermark_id")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"permission_level" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "ai_access_granted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "ai_access_granted_at" timestamp;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "ai_access_granted_by" uuid;--> statement-breakpoint
ALTER TABLE "ai_quotas" ADD CONSTRAINT "ai_quotas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_watermarks" ADD CONSTRAINT "download_watermarks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_watermarks" ADD CONSTRAINT "download_watermarks_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_watermarks" ADD CONSTRAINT "download_watermarks_downloaded_by_users_id_fk" FOREIGN KEY ("downloaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_custom_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_custom_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_quota_org_idx" ON "ai_quotas" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "custom_role_org_idx" ON "custom_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_role_org_name_idx" ON "custom_roles" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "dl_watermark_doc_idx" ON "download_watermarks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "dl_watermark_user_idx" ON "download_watermarks" USING btree ("downloaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "dl_watermark_wm_id_idx" ON "download_watermarks" USING btree ("watermark_id");--> statement-breakpoint
CREATE INDEX "dl_watermark_payload_hash_idx" ON "download_watermarks" USING btree ("payload_hash");--> statement-breakpoint
CREATE INDEX "role_perm_role_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_perm_resource_idx" ON "role_permissions" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_perm_unique_idx" ON "role_permissions" USING btree ("role_id","resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_assign_unique_idx" ON "user_role_assignments" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "user_role_assign_user_idx" ON "user_role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_assign_role_idx" ON "user_role_assignments" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_ai_access_granted_by_users_id_fk" FOREIGN KEY ("ai_access_granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;