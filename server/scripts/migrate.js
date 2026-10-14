// Applies db/migrations/*.sql in name order, once each. Usage: npm run migrate
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'migrations');
const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
for (const f of files) {
  if (done.has(f)) { console.log('skip   ', f); continue; }
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(await readFile(join(dir, f), 'utf8'));
    await c.query('INSERT INTO schema_migrations(name) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
    await c.query('COMMIT');
    console.log('applied', f);
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
await pool.end();
