import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client(process.env.DATABASE_URL);
await client.connect();

// Check if table already exists
const check = await client.query("SELECT to_regclass('public.document_signatures')");
if (check.rows[0].to_regclass) {
  console.log('Table document_signatures already exists');
  await client.end();
  process.exit(0);
}

await client.query(`
CREATE TABLE document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  form_instance_id uuid,
  docuseal_submission_id integer,
  docuseal_template_id integer,
  docuseal_submitter_id integer,
  docuseal_slug varchar(100),
  signer_user_id uuid REFERENCES users(id),
  signer_email text NOT NULL,
  signer_name text,
  signer_role text DEFAULT 'First Party',
  status text DEFAULT 'pending',
  sent_at timestamp,
  opened_at timestamp,
  completed_at timestamp,
  declined_at timestamp,
  decline_reason text,
  signed_document_url text,
  signed_document_path text,
  audit_log_url text,
  embed_src text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX doc_sig_org_idx ON document_signatures(organization_id);
CREATE INDEX doc_sig_task_idx ON document_signatures(task_id);
CREATE INDEX doc_sig_doc_idx ON document_signatures(document_id);
CREATE INDEX doc_sig_status_idx ON document_signatures(status);
`);

console.log('Table document_signatures created successfully');
await client.end();
