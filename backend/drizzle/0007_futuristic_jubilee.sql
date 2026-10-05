ALTER TABLE "documents" ADD COLUMN "blockchain_anchored" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "blockchain_anchor_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "auto_anchor_on_edit" boolean DEFAULT false;