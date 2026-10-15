import { q } from './db.js';

// require_approval: false = bypass (volunteer changes go live at once). Cached briefly; changed only by an admin.
let cache = { at: 0, value: true };
export async function requireApproval() {
  if (Date.now() - cache.at < 3000) return cache.value;
  const r = await q("SELECT value FROM settings WHERE key = 'require_approval'");
  cache = { at: Date.now(), value: r.rows[0] ? r.rows[0].value === true : true };
  return cache.value;
}
export async function setRequireApproval(value, userId) {
  await q(`INSERT INTO settings(key, value, updated_by, updated_at) VALUES ('require_approval', $1::jsonb, $2, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [JSON.stringify(!!value), userId]);
  cache = { at: Date.now(), value: !!value };
}
/** Will this user's change go live at once? Admins always publish directly. */
export const goesLive = async u => u.role === 'admin' || !(await requireApproval());
