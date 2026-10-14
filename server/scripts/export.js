// Backup/export without the web server: writes exports/temples.ndjson and exports/community.json from the database.
// Usage: npm run export [outdir]      (a full-fidelity backup is also available with:  pg_dump "$DATABASE_URL" > backup.sql)
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../db.js';

const out = process.argv[2] || 'exports';
await mkdir(out, { recursive: true });
const nd = createWriteStream(join(out, 'temples.ndjson'));
let last = '', n = 0;
for (;;) {
  const r = await pool.query('SELECT id, country, state, district, name, native_name, lat, lon, deity, deity_basis, tradition, completeness, photo, tags, enrich, computed FROM temples WHERE id > $1 ORDER BY id LIMIT 2000', [last]);
  if (!r.rowCount) break;
  for (const t of r.rows) { nd.write(JSON.stringify(t) + '\n'); n++; }
  last = r.rows[r.rowCount - 1].id;
}
await new Promise(res => nd.end(res));
const [ratings, comments, needs, notes, fields, edits, settings] = await Promise.all([
  pool.query('SELECT temple_id, item_key, stars, display_name, updated_at FROM ratings ORDER BY temple_id, item_key'),
  pool.query('SELECT id, temple_id, item_key, text, display_name, created_at, hidden FROM comments ORDER BY created_at'),
  pool.query("SELECT id, temple_id, category, area, severity, title, description, observed_on, evidence, status, approval, display_name, created_at FROM needs_reports ORDER BY created_at"),
  pool.query("SELECT id, temple_id, type, text, basis, approval, hidden, display_name, created_at FROM notes ORDER BY created_at"),
  pool.query("SELECT temple_id, field_key, value, source_type, source_ref, checked_on, display_name, current, approval, created_at FROM field_values ORDER BY id"),
  pool.query('SELECT id, at, actor_name, entity, entity_id, action, before, after, revert_of FROM edits ORDER BY id'),
  pool.query('SELECT key, value FROM settings'),
]);
await writeFile(join(out, 'community.json'), JSON.stringify({ exported_at: new Date().toISOString(), note: 'No email addresses are included. Includes pending/hidden rows (flagged) for a full backup.',
  settings: settings.rows, ratings: ratings.rows, comments: comments.rows, needs_reports: needs.rows, notes: notes.rows, field_values: fields.rows, edits: edits.rows }, null, 1));
console.log(`wrote ${n} temples and community data to ${out}/`);
await pool.end();
