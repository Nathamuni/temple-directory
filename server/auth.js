import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { q } from './db.js';

export const IS_PROD = process.env.NODE_ENV === 'production';
export const sha = s => createHash('sha256').update(s).digest('hex');
export const token = () => randomBytes(32).toString('hex');
const cookieOpts = days => ({ path: '/', httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge: days * 86400 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The anonymous browser behind this request (httpOnly cookie). Created on first use. */
export async function device(req, reply) {
  if (req.deviceId) return req.deviceId;
  let id = req.cookies.td_device;
  if (id && UUID.test(id)) {
    const r = await q('UPDATE devices SET last_seen = now() WHERE id = $1 RETURNING id', [id]);
    if (r.rowCount) return (req.deviceId = id);
  }
  id = randomUUID();
  await q('INSERT INTO devices(id) VALUES ($1)', [id]);
  reply.setCookie('td_device', id, cookieOpts(365));
  return (req.deviceId = id);
}

/** The signed-in volunteer, or null. */
export async function user(req) {
  if (req.userLoaded) return req.user;
  req.userLoaded = true;
  const t = req.cookies.td_session;
  if (!t) return (req.user = null);
  const r = await q('SELECT u.id, u.email, u.display_name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [sha(t)]);
  return (req.user = r.rows[0] || null);
}
export async function startSession(reply, userId) {
  const t = token();
  await q("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')", [sha(t), userId]);
  await q('UPDATE users SET last_login = now() WHERE id = $1', [userId]);
  reply.setCookie('td_session', t, cookieOpts(30));
}
export const needUser = async (req, reply) => {
  const u = await user(req);
  if (!u) { reply.code(401).send({ error: 'Sign in as a volunteer to add or edit data.', code: 'SIGN_IN_REQUIRED' }); return null; }
  return u;
};
export const needAdmin = async (req, reply) => {
  const u = await needUser(req, reply);
  if (!u) return null;
  if (u.role !== 'admin') { reply.code(403).send({ error: 'Admin only.' }); return null; }
  return u;
};

/** In-memory sliding-window limiter. One process only; use a shared store (Redis) if you run several instances. */
const hits = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now); hits.set(key, arr);
  return false;
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.length || now - a[a.length - 1] > 3600e3) hits.delete(k); }, 600e3).unref();

export const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
export const isEmail = s => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(s) && s.length <= 254;
