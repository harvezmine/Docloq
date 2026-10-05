#!/usr/bin/env node
// CI guardrail: fails if any src/ file has UUID-only lookups on tenant-scoped tables.
// Run: node scripts/lint-tenant-queries.js

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '../src');

// Pattern: from(documents/folders).where(eq(table.id, — without organizationId nearby
const UNSAFE_PATTERNS = [
  {
    table: 'documents',
    pattern: /from\(documents\)\.where\(eq\(documents\.id/g,
    safeIndicator: 'documents\.organizationId',
    description: 'UUID-only document lookup (missing organizationId filter)',
  },
  {
    table: 'folders',
    pattern: /from\(folders\)\.where\(eq\(folders\.id/g,
    safeIndicator: 'folders\.organizationId',
    description: 'UUID-only folder lookup (missing organizationId filter)',
  },
];

function walkFiles(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkFiles(full, results);
    } else if (entry.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

let violations = 0;

for (const file of walkFiles(SRC_DIR)) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const rel = relative(SRC_DIR, file);

  for (const { pattern, safeIndicator, description } of UNSAFE_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      // Get a 300-char window around the match to check for org filter
      const window = content.substring(Math.max(0, match.index - 50), match.index + 300);
      // Allow intentional suppressions via "// tenant-lint-ignore" on the same line
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const lineText = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
      if (lineText.includes('tenant-lint-ignore')) continue;
      if (!new RegExp(safeIndicator).test(window)) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        console.error(`[tenant-lint] UNSAFE: ${rel}:${lineNum} — ${description}`);
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n[tenant-lint] Found ${violations} tenant isolation violation(s). Fix before merging.`);
  process.exit(1);
} else {
  console.log('[tenant-lint] All queries pass tenant isolation check.');
  process.exit(0);
}
