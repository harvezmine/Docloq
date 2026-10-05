CREATE TABLE IF NOT EXISTS "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" varchar(7),
	"created_by" uuid,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid,
	"document_id" uuid NOT NULL,
	"form_instance_id" uuid,
	"docuseal_submission_id" integer,
	"docuseal_template_id" integer,
	"docuseal_submitter_id" integer,
	"docuseal_slug" varchar(100),
	"signer_user_id" uuid,
	"signer_email" text NOT NULL,
	"signer_name" text,
	"signer_role" text DEFAULT 'First Party',
	"status" text DEFAULT 'pending',
	"sent_at" timestamp,
	"opened_at" timestamp,
	"completed_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"signed_document_url" text,
	"signed_document_path" text,
	"audit_log_url" text,
	"embed_src" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "position" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_signer_user_id_users_id_fk" FOREIGN KEY ("signer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dept_org_idx" ON "departments" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dept_org_name_idx" ON "departments" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_sig_org_idx" ON "document_signatures" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_sig_task_idx" ON "document_signatures" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_sig_doc_idx" ON "document_signatures" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_sig_status_idx" ON "document_signatures" USING btree ("status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;