import 'dotenv/config';
import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

const r = await db.execute(sql`
  SELECT
    ('[]'::jsonb           @> '["a"]'::jsonb) AS empty_contains_a,
    ('["a"]'::jsonb        @> '["a"]'::jsonb) AS exact_contains_a,
    ('["a","b"]'::jsonb    @> '["a"]'::jsonb) AS multi_contains_a,
    ((NULL::jsonb          @> '["a"]'::jsonb) IS NULL) AS null_yields_null
`);
console.log(JSON.stringify((r.rows || r)[0], null, 1));
process.exit(0);
