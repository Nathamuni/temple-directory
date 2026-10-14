import { q } from '../db.js';
import { user, startSession, sha, token, limited, clean, isEmail, IS_PROD } from '../auth.js';
import { requireApproval } from '../settings.js';

const BASE_URL = () => (process.env.BASE_URL || `http://localhost:${process.env.PORT || 8080}`).replace(/\/$/, '');
const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const devLinksOn = () => process.env.DEV_LINKS === '1';
// The dummy admin: any visitor can click it and become admin. On for local development (DEV_LINKS=1, not production),
// or anywhere when ALLOW_DEV_ADMIN=1 is set on purpose. Off by default in production.
export const dummyAdminOn = () => (devLinksOn() && !IS_PROD) || process.env.ALLOW_DEV_ADMIN === '1';

/* ---- EMAIL VERIFICATION (DISABLED FOR NOW) ----------------------------------------------------------------
   Kept for later. To bring it back: uncomment this block and the two routes below (request-link, verify), delete the
   /api/auth/sign-in route, and re-enable the ADMIN_EMAILS role line inside verify.
async function sendMail(to, link) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.MAIL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Global Temple Directory <onboarding@resend.dev>', to, subject: 'Your sign-in link for Global Temple Directory',
      text: `Open this link to sign in as a volunteer (valid for 15 minutes):\n\n${link}\n\nIf you did not ask for this, ignore this email.` }),
  });
  if (!r.ok) throw new Error('mail provider returned ' + r.status);
}
*/

export default async function routes(app) {
  app.get('/api/me', async req => {
    const u = await user(req);
    return { user: u && { name: u.display_name, role: u.role }, approvalRequired: await requireApproval(), signIn: { verified: false, dev: dummyAdminOn() } };
  });

  /* ---- EMAIL VERIFICATION ROUTES (DISABLED FOR NOW) -- see the note above sendMail() --------------------------
  app.post('/api/auth/request-link', async (req, reply) => {
    const email = clean(req.body?.email, 254).toLowerCase(), name = clean(req.body?.displayName, 40);
    if (!isEmail(email)) return reply.code(400).send({ error: 'Enter a valid email address.' });
    if (name.length < 2) return reply.code(400).send({ error: 'Enter a display name (2-40 characters).' });
    if (limited('ml-ip:' + req.ip, 10, 3600e3) || limited('ml-em:' + email, 5, 3600e3)) return reply.code(429).send({ error: 'Too many sign-in requests. Try again later.' });
    const t = token();
    await q("INSERT INTO magic_links(token_hash, email, display_name, expires_at) VALUES ($1, $2, $3, now() + interval '15 minutes')", [sha(t), email, name]);
    const link = `${BASE_URL()}/api/auth/verify?token=${t}`;
    if (process.env.MAIL_API_KEY) {
      try { await sendMail(email, link); } catch (e) { req.log.error(e); return reply.code(502).send({ error: 'Could not send the email. Try again later.' }); }
      return { ok: true, sent: true };
    }
    if (devLinksOn()) return { ok: true, sent: false, devLink: link };
    return reply.code(503).send({ error: 'Email sign-in is not configured on this server (set MAIL_API_KEY).' });
  });

  app.get('/api/auth/verify', async (req, reply) => {
    const t = String(req.query.token || '');
    const r = await q('UPDATE magic_links SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING email, display_name', [sha(t)]);
    if (!r.rowCount) return reply.code(400).type('text/html').send('<p>This sign-in link is invalid or has expired. <a href="/">Go back</a> and request a new one.</p>');
    const { email, display_name } = r.rows[0];
    const role = adminEmails().includes(email) ? 'admin' : 'volunteer';
    const u = await q(`INSERT INTO users(email, display_name, role) VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET role = CASE WHEN EXCLUDED.role = 'admin' THEN 'admin' ELSE users.role END RETURNING id`, [email, display_name, role]);
    await startSession(reply, u.rows[0].id);
    return reply.redirect('/#volunteer');
  });
  */

  // Simple sign-in: store the name and email, no verification. TEMPORARY while email verification is off.
  // An email address does NOT prove identity here, so this never grants admin: ADMIN_EMAILS is ignored and an existing
  // admin's email is refused. Admin is only the dummy-admin button below.
  app.post('/api/auth/sign-in', async (req, reply) => {
    const email = clean(req.body?.email, 254).toLowerCase(), name = clean(req.body?.displayName, 40);
    if (!isEmail(email)) return reply.code(400).send({ error: 'Enter a valid email address.' });
    if (name.length < 2) return reply.code(400).send({ error: 'Enter a display name (2-40 characters).' });
    if (limited('si-ip:' + req.ip, 30, 3600e3)) return reply.code(429).send({ error: 'Too many sign-ins. Try again later.' });
    const existing = await q('SELECT id, role FROM users WHERE email = $1', [email]);
    if (existing.rows[0]?.role === 'admin') return reply.code(403).send({ error: 'That email belongs to an admin. Use a different email.' });
    const u = await q(`INSERT INTO users(email, display_name, role) VALUES ($1, $2, 'volunteer')
      ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id`, [email, name]);
    await startSession(reply, u.rows[0].id);
    return { ok: true };
  });

  // Dummy admin for demos and development (see dummyAdminOn above).
  app.post('/api/auth/dev-admin', async (req, reply) => {
    if (!dummyAdminOn()) return reply.code(404).send({ error: 'Not available.' });
    const u = await q(`INSERT INTO users(email, display_name, role) VALUES ('admin@demo.local', 'Demo admin', 'admin')
      ON CONFLICT (email) DO UPDATE SET role = 'admin' RETURNING id`);
    await startSession(reply, u.rows[0].id);
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const t = req.cookies.td_session;
    if (t) await q('DELETE FROM sessions WHERE token_hash = $1', [sha(t)]);
    reply.clearCookie('td_session', { path: '/' });
    return { ok: true };
  });
}
