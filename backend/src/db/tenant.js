// Use requireInOrg() instead of raw id lookups to prevent cross-tenant data access.

import { db } from './index.js';
import { eq, and } from 'drizzle-orm';

// Returns null if not found or belongs to another org.
export async function findInOrg(table, id, orgId) {
  const [row] = await db
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.organizationId, orgId)))
    .limit(1);
  return row || null;
}

/**
 * Same as findInOrg but throws a 404-shaped error if not found.
 * Caller's try/catch converts to HTTP 404.
 */
export async function requireInOrg(table, id, orgId) {
  const row = await findInOrg(table, id, orgId);
  if (!row) {
    const err = new Error('Resource not found');
    err.status = 404;
    throw err;
  }
  return row;
}
