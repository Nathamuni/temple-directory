// Container entry point: apply migrations, load the temples on first start (empty table), then run the server.
// Safe to run on every start: migrations and the import are idempotent.
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const dir = dirname(fileURLToPath(import.meta.url));
const run = f => execFileSync(process.execPath, [join(dir, f)], { stdio: 'inherit', env: process.env });

run('migrate.js');
const n = (await pool.query('SELECT count(*)::int AS n FROM temples')).rows[0].n;   // the pool stays open: the server below uses it
if (n === 0) { console.log('temples table is empty: importing data/india-temples.json'); run('import-temples.js'); }
else console.log(`temples table already has ${n} rows: skipping import`);
await import('../index.js');
