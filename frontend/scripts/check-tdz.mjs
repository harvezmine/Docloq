#!/usr/bin/env node
// TDZ scanner — cek apakah useEffect/useCallback/useMemo deps refer ke variable yang declared belakangan.
// Run sebelum push untuk cegah ReferenceError "Cannot access X before initialization".

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const files = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f.endsWith('.jsx') || f.endsWith('.tsx'))
  .filter(Boolean);

if (files.length === 0) {
  console.log('[TDZ] No JSX/TSX files staged.');
  process.exit(0);
}

let totalIssues = 0;
// Hanya cek const top-level (indent 2 spaces persis, hindari false positive dari nested component)
const declarePattern = /^  const\s+(\w+)\s*=\s*use(?:Callback|Memo|State|Ref|Reducer)/;
const depsPattern = /^\s*\}, \[([^\]]+)\]\);/;

for (const file of files) {
  let code;
  try { code = readFileSync(file, 'utf8'); } catch { continue; }
  const lines = code.split('\n');

  const declared = new Map();
  lines.forEach((line, i) => {
    const m = line.match(declarePattern);
    if (m) declared.set(m[1], i + 1);
  });

  lines.forEach((line, i) => {
    const m = line.match(depsPattern);
    if (!m) return;
    const deps = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const dep of deps) {
      if (declared.has(dep) && declared.get(dep) > i + 1) {
        console.error(`[TDZ] ${file}:${i + 1} — '${dep}' declared at L${declared.get(dep)}`);
        totalIssues++;
      }
    }
  });
}

if (totalIssues > 0) {
  console.error(`\n[TDZ] ${totalIssues} issue(s) found. Fix before push.`);
  process.exit(1);
}
console.log('[TDZ] OK — no hook order issues.');
