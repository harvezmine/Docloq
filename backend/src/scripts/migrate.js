// Applies drizzle/*.sql files in order, tracking state in "_migrations" — unlike
// `drizzle-kit migrate`, this needs no meta/_journal.json and also runs hand-written data migrations.

import 'dotenv/config';
import pg from 'pg';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../drizzle');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "id" serial PRIMARY KEY,
        "filename" text NOT NULL UNIQUE,
        "applied_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows } = await client.query('SELECT filename FROM "_migrations"');
    const applied = new Set(rows.map((r) => r.filename));

    // Existing DB with empty tracking table: record current migrations without re-running them.
    if (applied.size === 0) {
      const { rows: t } = await client.query(
        "SELECT to_regclass('public.users') IS NOT NULL AS exists"
      );
      if (t[0]?.exists) {
        for (const f of files) {
          await client.query(
            'INSERT INTO "_migrations" ("filename") VALUES ($1) ON CONFLICT DO NOTHING',
            [f]
          );
          applied.add(f);
        }
        console.log(`[migrate] baselined ${files.length} existing migration(s) (DB already provisioned)`);
      }
    }

    let ran = 0;
    for (const f of files) {
      if (applied.has(f)) continue;
      const sql = readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
      console.log(`[migrate] applying ${f} ...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO "_migrations" ("filename") VALUES ($1)', [f]);
        await client.query('COMMIT');
        ran++;
        console.log(`[migrate] applied ${f}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] FAILED ${f}: ${err.message}`);
        throw err;
      }
    }

    console.log(ran === 0 ? '[migrate] up to date' : `[migrate] applied ${ran} migration(s)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[migrate] error:', err.message);
  process.exit(1);
});
