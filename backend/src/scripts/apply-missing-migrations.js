// Applies missing migrations 0003, 0004, 0005.

import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    
    const { rows: startDateCol } = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'form_instances' AND column_name = 'start_date'
    `);
    if (startDateCol.length === 0) {
      await client.query(`ALTER TABLE "form_instances" ADD COLUMN "start_date" timestamp;`);
      console.log(' Added start_date to form_instances');
    } else {
      console.log('⏭  start_date already exists on form_instances');
    }

    // Migration 0004: departments table
    const { rows: deptTable } = await client.query(`
      SELECT to_regclass('public.departments') AS exists
    `);
    if (!deptTable[0].exists) {
      await client.query(`
        CREATE TABLE "departments" (
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
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS "dept_org_idx" ON "departments" USING btree ("organization_id");`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "dept_org_name_idx" ON "departments" USING btree ("organization_id","name");`);
      await client.query(`
        ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_organizations_id_fk" 
        FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
      `);
      console.log(' Created departments table');
    } else {
      console.log('⏭  departments table already exists');
    }

    // Migration 0004: users columns (phone, position, department_id)
    const addColumnIfNotExists = async (table, column, type) => {
      const { rows } = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [table, column]);
      if (rows.length === 0) {
        await client.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type};`);
        console.log(` Added ${column} to ${table}`);
        return true;
      } else {
        console.log(`⏭  ${column} already exists on ${table}`);
        return false;
      }
    };

    await addColumnIfNotExists('users', 'phone', 'text');
    await addColumnIfNotExists('users', 'position', 'text');
    const addedDeptId = await addColumnIfNotExists('users', 'department_id', 'uuid');

    if (addedDeptId) {
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" 
          FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log(' Added users.department_id FK constraint');
    }

    // Migration 0004: last_activity_at on user_sessions
    await addColumnIfNotExists('user_sessions', 'last_activity_at', 'timestamp DEFAULT now()');

    // Migration 0005: document_signatures table (should already exist from manual script)
    const { rows: sigTable } = await client.query(`
      SELECT to_regclass('public.document_signatures') AS exists
    `);
    if (!sigTable[0].exists) {
      await client.query(`
        CREATE TABLE "document_signatures" (
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
      `);
      await client.query(`ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;`);
      await client.query(`ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null;`);
      await client.query(`ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade;`);
      await client.query(`ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_signer_user_id_users_id_fk" FOREIGN KEY ("signer_user_id") REFERENCES "public"."users"("id");`);
      await client.query(`CREATE INDEX IF NOT EXISTS "doc_sig_org_idx" ON "document_signatures" USING btree ("organization_id");`);
      await client.query(`CREATE INDEX IF NOT EXISTS "doc_sig_task_idx" ON "document_signatures" USING btree ("task_id");`);
      await client.query(`CREATE INDEX IF NOT EXISTS "doc_sig_doc_idx" ON "document_signatures" USING btree ("document_id");`);
      await client.query(`CREATE INDEX IF NOT EXISTS "doc_sig_status_idx" ON "document_signatures" USING btree ("status");`);
      console.log('Created document_signatures table');
    } else {
      console.log('document_signatures table already exists');
    }

    await client.query('COMMIT');
    console.log('\n All missing migrations applied successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(' Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => process.exit(1));
