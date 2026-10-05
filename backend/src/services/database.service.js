import { spawn } from 'child_process';
import fs from 'fs';
import zlib from 'zlib';
import { pool } from '../db/index.js';
import { listBackups } from './audit-recovery.service.js';

const BACKUPS_DIR = process.env.BACKUPS_DIR || '/backups';

export { listBackups };

export const getOverview = async () => {
  const one = async (text) => (await pool.query(text)).rows[0];
  const ver = await one('SELECT version() AS v');
  const sz = await one('SELECT current_database() AS db, pg_database_size(current_database()) AS bytes, pg_size_pretty(pg_database_size(current_database())) AS pretty');
  const tc = await one("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  const conn = await one('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()');
  return {
    version: ver.v,
    database: sz.db,
    sizeBytes: Number(sz.bytes),
    sizePretty: sz.pretty,
    tableCount: tc.n,
    connections: conn.n,
  };
};

export const listTables = async () => {
  const { rows } = await pool.query(
    `SELECT c.relname AS name,
            c.reltuples::bigint AS rows,
            pg_total_relation_size(c.oid) AS bytes,
            pg_size_pretty(pg_total_relation_size(c.oid)) AS size
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC`
  );
  // -1 = never analyzed
  return rows.map((r) => ({ name: r.name, rows: Math.max(0, Number(r.rows)), bytes: Number(r.bytes), size: r.size }));
};

const prettyBytes = (n) => {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
};

const stampNow = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
};

export const runBackup = () =>
  new Promise((resolve, reject) => {
    const file = `pg_docloq_${stampNow()}_manual.sql.gz`;
    const outPath = `${BACKUPS_DIR}/${file}`;
    let out;
    try {
      out = fs.createWriteStream(outPath);
    } catch (e) {
      return reject(new Error('Cannot write to backups dir: ' + e.message));
    }
    const dump = spawn('pg_dump', ['-d', process.env.DATABASE_URL], { stdio: ['ignore', 'pipe', 'pipe'] });
    const gz = zlib.createGzip({ level: 9 });
    let errBuf = '';
    let failed = false;
    const fail = (msg) => {
      if (failed) return;
      failed = true;
      try { fs.unlinkSync(outPath); } catch { /* ignore */ }
      reject(new Error(msg));
    };
    dump.on('error', (e) => fail('pg_dump not available: ' + e.message));
    dump.stderr.on('data', (d) => { errBuf += d.toString(); });
    dump.stdout.pipe(gz).pipe(out);
    dump.on('close', (code) => {
      if (code !== 0) fail(`pg_dump exited ${code}: ${errBuf.slice(0, 300)}`);
    });
    out.on('error', (e) => fail('write failed: ' + e.message));
    out.on('finish', () => {
      if (failed) return;
      try {
        const st = fs.statSync(outPath);
        resolve({ file, sizeBytes: st.size, size: prettyBytes(st.size) });
      } catch (e) {
        reject(e);
      }
    });
  });
