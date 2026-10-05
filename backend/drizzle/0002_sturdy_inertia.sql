CREATE TYPE "public"."form_instance_status" AS ENUM('draft', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."workflow_action" AS ENUM('fill', 'review', 'approve', 'sign');--> statement-breakpoint
CREATE TYPE "public"."workflow_step_status" AS ENUM('pending', 'in_progress', 'completed', 'skipped');--> statement-breakpoint
CREATE TABLE "form_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "form_instance_status" DEFAULT 'draft',
	"due_date" timestamp,
	"completed_at" timestamp,
	"generated_document_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_instance_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"action" "workflow_action" NOT NULL,
	"assigned_to" uuid NOT NULL,
	"status" "workflow_step_status" DEFAULT 'pending',
	"completed_at" timestamp,
	"notes" text,
	"task_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "icon" text DEFAULT 'document';--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "usage_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "task_type" text DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "related_form_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "related_form_instance_id" uuid;--> statement-breakpoint
ALTER TABLE "form_instances" ADD CONSTRAINT "form_instances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_instances" ADD CONSTRAINT "form_instances_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_instances" ADD CONSTRAINT "form_instances_generated_document_id_documents_id_fk" FOREIGN KEY ("generated_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_instances" ADD CONSTRAINT "form_instances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_workflow_steps" ADD CONSTRAINT "form_workflow_steps_form_instance_id_form_instances_id_fk" FOREIGN KEY ("form_instance_id") REFERENCES "public"."form_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_workflow_steps" ADD CONSTRAINT "form_workflow_steps_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_workflow_steps" ADD CONSTRAINT "form_workflow_steps_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_instance_org_idx" ON "form_instances" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "form_instance_form_idx" ON "form_instances" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_instance_status_idx" ON "form_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_step_instance_idx" ON "form_workflow_steps" USING btree ("form_instance_id");--> statement-breakpoint
CREATE INDEX "workflow_step_assignee_idx" ON "form_workflow_steps" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "form_category_idx" ON "forms" USING btree ("category");