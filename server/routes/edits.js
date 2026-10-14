// Volunteer writes (sign-in required). Each change either goes live at once or waits for an admin, depending on the
// admin's "require approval" switch (default OFF = bypass). Admins always publish directly. Everything is logged in `edits`.
import { q, pool } from '../db.js';
import { needUser, needAdmin, user, limited, clean } from '../auth.js';
import { FIELDS, fieldSchema, needCategories } from '../checklist.js';
import { requireApproval, setRequireApproval, goesLive } from '../settings.js';

const bad = (reply, msg, code = 400) => reply.code(code).send({ error: msg });
const log = (c, u, entity, entityId, action, before, after, revertOf = null) =>
  c.query('INSERT INTO edits(actor_user_id, actor_name, entity, entity_id, action, before, after, revert_of) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [u.id, u.display_name, entity, entityId, action, before && JSON.stringify(before), after && JSON.stringify(after), revertOf]);
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && s <= new Date().toISOString().slice(0, 10);
const validUrl = s => { try { return ['http:', 'https:'].includes(new URL(s).protocol); } catch { return false; } };
const CATEGORIES = new Set([...needCategories.categories.map(c => c.key), ...Object.keys(needCategories.legacy)]);
const TABLES = { field: 'field_values', need: 'needs_reports', note: 'notes' };
const ENTITY = { field: 'field_value', need: 'needs_report', note: 'note' };

async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
/** Make a field value current (demoting the previous one). Returns the previous current row or null. */
async function publishField(c, row) {
  const old = (await c.query('UPDATE field_values SET current = false WHERE temple_id = $1 AND field_key = $2 AND current AND id <> $3 RETURNING *', [row.temple_id, row.field_key, row.id])).rows[0] || null;
  const nw = (await c.query("UPDATE field_values SET current = true, approval = 'approved', reject_reason = NULL WHERE id = $1 RETURNING *", [row.id])).rows[0];
  return { old, nw };
}

export default async function routes(app) {
  // ---- profile fields (value + source + date) ----
  app.get('/api/fields/:templeId', async req => {
    const u = await user(req);
    const live = await q('SELECT field_key, value, source_type, source_ref, checked_on, display_name, created_at FROM field_values WHERE temple_id = $1 AND current', [req.params.templeId]);
    const pend = u ? await q("SELECT id, field_key, value, source_type, source_ref, checked_on, display_name, created_at FROM field_values WHERE temple_id = $1 AND approval = 'pending' AND ($2 OR user_id = $3)", [req.params.templeId, u.role === 'admin', u.id]) : { rows: [] };
    const map = x => ({ key: x.field_key, value: x.value, sourceType: x.source_type, sourceRef: x.source_ref, checkedOn: x.checked_on.toISOString().slice(0, 10), by: x.display_name, at: x.created_at });
    return { values: live.rows.map(map), pending: pend.rows.map(x => ({ ...map(x), id: x.id })) };
  });

  app.post('/api/fields', async (req, reply) => {
    const u = await needUser(req, reply); if (!u) return;
    const b = req.body || {}, f = FIELDS.get(String(b.fieldKey));
    if (!f) return bad(reply, 'Unknown field.');
    const value = clean(b.value, 500), ref = clean(b.sourceRef, 300), type = String(b.sourceType || ''), when = String(b.checkedOn || '');
    if (!value) return bad(reply, 'Enter the value.');
    if (f.type === 'url' && !validUrl(value)) return bad(reply, 'Enter a valid web link (https://…).');
    if (!f.sources.includes(type) || !fieldSchema.sources[type]) return bad(reply, 'Choose one of the accepted source types for this field.');
    if (!ref) return bad(reply, 'Add the source: a link, or where and when you saw it.');
    if (!validDate(when)) return bad(reply, 'Enter the date you checked this (not in the future).');
    if (limited('edit:' + u.id, 120, 3600e3)) return bad(reply, 'Too many edits. Try again later.', 429);
    if (!(await q('SELECT 1 FROM temples WHERE id = $1', [b.templeId])).rowCount) return bad(reply, 'Unknown temple.', 404);
    const live = await goesLive(u);
    return tx(async c => {
      await c.query("DELETE FROM field_values WHERE temple_id = $1 AND field_key = $2 AND user_id = $3 AND approval = 'pending'", [b.templeId, f.key, u.id]);   // a newer suggestion replaces my older pending one
      const row = (await c.query('INSERT INTO field_values(temple_id, field_key, value, source_type, source_ref, checked_on, user_id, display_name, current, approval) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9) RETURNING *',
        [b.templeId, f.key, value, type, ref, when, u.id, u.display_name, live ? 'approved' : 'pending'])).rows[0];
      if (!live) { await log(c, u, 'field_value', String(row.id), 'submit', null, row); return { ok: true, id: row.id, pending: true, by: u.display_name }; }
      const { old, nw } = await publishField(c, row);
      await log(c, u, 'field_value', String(nw.id), old ? 'update' : 'create', old, nw);
      return { ok: true, id: nw.id, pending: false, by: u.display_name };
    });
  });

  // ---- needs reports ----
  app.get('/api/needs', async req => {
    const u = await user(req), { templeId, state, status, category } = req.query;
    const p = [u?.role === 'admin' || false, u?.id || null], w = ["(n.approval = 'approved' OR (n.approval = 'pending' AND ($1 OR n.user_id = $2)))"];
    for (const [col, v] of [['n.temple_id', templeId], ['t.state', state], ['n.status', status], ['n.category', category]]) if (v) { p.push(v); w.push(`${col} = $${p.length}`); }
    const r = await q(`SELECT n.id, n.temple_id, t.name AS temple_name, t.state, t.district, n.category, n.area, n.severity, n.title, n.description, n.observed_on, n.evidence, n.status, n.approval, n.display_name, n.created_at
      FROM needs_reports n JOIN temples t ON t.id = n.temple_id WHERE ${w.join(' AND ')} ORDER BY n.created_at DESC LIMIT 300`, p);
    return { reports: r.rows };
  });
  app.post('/api/needs', async (req, reply) => {
    const u = await needUser(req, reply); if (!u) return;
    const b = req.body || {};
    const title = clean(b.title, 100), desc = clean(b.description, 800), area = clean(b.area, 60), ev = clean(b.evidence, 300);
    if (!CATEGORIES.has(b.category)) return bad(reply, 'Choose a category.');
    if (!['Low', 'Medium', 'High'].includes(b.severity)) return bad(reply, 'Choose a severity.');
    if (!title || desc.length < 20 || !area) return bad(reply, 'Add a title, the place, and at least 20 characters describing what you saw.');
    if (!validDate(String(b.observedOn || ''))) return bad(reply, 'Enter the date you saw it (not in the future).');
    if (ev && !validUrl(ev)) return bad(reply, 'Evidence must be a valid web link.');
    if (limited('edit:' + u.id, 120, 3600e3)) return bad(reply, 'Too many edits. Try again later.', 429);
    if (!(await q('SELECT 1 FROM temples WHERE id = $1', [b.templeId])).rowCount) return bad(reply, 'Unknown temple.', 404);
    const live = await goesLive(u);
    return tx(async c => {
      const r = (await c.query('INSERT INTO needs_reports(temple_id, category, area, severity, title, description, observed_on, evidence, user_id, display_name, approval) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
        [b.templeId, b.category, area, b.severity, title, desc, b.observedOn, ev || null, u.id, u.display_name, live ? 'approved' : 'pending'])).rows[0];
      await log(c, u, 'needs_report', r.id, live ? 'create' : 'submit', null, r);
      return { ok: true, id: r.id, pending: !live };
    });
  });
  // Changing a report's progress status: any signed-in volunteer while approval is off; admins only while it is on.
  app.post('/api/needs/:id/status', async (req, reply) => {
    const u = await needUser(req, reply); if (!u) return;
    if (!(await goesLive(u))) return bad(reply, 'While admin approval is on, only an admin can change a report’s status.', 403);
    const st = req.body?.status;
    if (!['Open', 'In progress', 'Resolved'].includes(st)) return bad(reply, 'Unknown status.');
    return tx(async c => {
      const old = (await c.query("SELECT * FROM needs_reports WHERE id = $1 AND approval = 'approved' FOR UPDATE", [req.params.id])).rows[0];
      if (!old) return bad(reply, 'Unknown report.', 404);
      const nw = (await c.query('UPDATE needs_reports SET status = $2 WHERE id = $1 RETURNING *', [req.params.id, st])).rows[0];
      await log(c, u, 'needs_report', old.id, 'update', old, nw);
      return { ok: true };
    });
  });

  // ---- notes (dress code, queues, offerings...) ----
  app.get('/api/notes/:templeId', async req => {
    const u = await user(req);
    const r = await q("SELECT id, type, text, basis, display_name, approval, created_at FROM notes WHERE temple_id = $1 AND NOT hidden AND (approval = 'approved' OR (approval = 'pending' AND ($2 OR user_id = $3))) ORDER BY created_at DESC LIMIT 100", [req.params.templeId, u?.role === 'admin' || false, u?.id || null]);
    return { notes: r.rows };
  });
  app.post('/api/notes', async (req, reply) => {
    const u = await needUser(req, reply); if (!u) return;
    const b = req.body || {}, text = clean(b.text, 600), basis = clean(b.basis, 200), type = clean(b.type, 40);
    if (text.length < 15) return bad(reply, 'Write at least 15 characters.');
    if (!basis) return bad(reply, 'Say how you know this (visit date, temple notice or a link).');
    if (!type) return bad(reply, 'Choose a topic.');
    if (limited('edit:' + u.id, 120, 3600e3)) return bad(reply, 'Too many edits. Try again later.', 429);
    if (!(await q('SELECT 1 FROM temples WHERE id = $1', [b.templeId])).rowCount) return bad(reply, 'Unknown temple.', 404);
    const live = await goesLive(u);
    return tx(async c => {
      const r = (await c.query('INSERT INTO notes(temple_id, type, text, basis, user_id, display_name, approval) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [b.templeId, type, text, basis, u.id, u.display_name, live ? 'approved' : 'pending'])).rows[0];
      await log(c, u, 'note', r.id, live ? 'create' : 'submit', null, r);
      return { ok: true, id: r.id, pending: !live };
    });
  });

  // ---- my submissions: so a volunteer can see what is pending, approved or rejected (with the reason) ----
  app.get('/api/my-submissions', async (req, reply) => {
    const u = await needUser(req, reply); if (!u) return;
    const [f, n, no] = await Promise.all([
      q("SELECT f.id::text, 'field' AS kind, t.name AS temple, f.field_key AS title, f.value AS detail, f.approval, f.reject_reason, f.created_at FROM field_values f JOIN temples t ON t.id = f.temple_id WHERE f.user_id = $1", [u.id]),
      q("SELECT n.id::text, 'need' AS kind, t.name AS temple, n.title, n.description AS detail, n.approval, n.reject_reason, n.created_at FROM needs_reports n JOIN temples t ON t.id = n.temple_id WHERE n.user_id = $1", [u.id]),
      q("SELECT n.id::text, 'note' AS kind, t.name AS temple, n.type AS title, n.text AS detail, n.approval, n.reject_reason, n.created_at FROM notes n JOIN temples t ON t.id = n.temple_id WHERE n.user_id = $1", [u.id]),
    ]);
    return { items: [...f.rows, ...n.rows, ...no.rows].sort((a, b) => b.created_at - a.created_at).slice(0, 100) };
  });

  // ---- admin: switch, approval queue, audit log, revert, hide ----
  app.get('/api/admin/settings', async (req, reply) => { if (!(await needAdmin(req, reply))) return; return { requireApproval: await requireApproval() }; });
  app.post('/api/admin/settings', async (req, reply) => {
    const a = await needAdmin(req, reply); if (!a) return;
    if (typeof req.body?.requireApproval !== 'boolean') return bad(reply, 'requireApproval must be true or false.');
    const before = await requireApproval();
    await setRequireApproval(req.body.requireApproval, a.id);
    await tx(c => log(c, a, 'setting', 'require_approval', 'update', { requireApproval: before }, { requireApproval: req.body.requireApproval }));
    return { ok: true, requireApproval: req.body.requireApproval };
  });

  app.get('/api/admin/pending', async (req, reply) => {
    if (!(await needAdmin(req, reply))) return;
    const [f, n, no] = await Promise.all([
      q("SELECT f.id::text, 'field' AS kind, f.temple_id, t.name AS temple, f.field_key AS title, f.value AS detail, f.source_ref, f.display_name, f.created_at FROM field_values f JOIN temples t ON t.id = f.temple_id WHERE f.approval = 'pending'"),
      q("SELECT n.id::text, 'need' AS kind, n.temple_id, t.name AS temple, n.title, n.description AS detail, n.evidence AS source_ref, n.display_name, n.created_at FROM needs_reports n JOIN temples t ON t.id = n.temple_id WHERE n.approval = 'pending'"),
      q("SELECT n.id::text, 'note' AS kind, n.temple_id, t.name AS temple, n.type AS title, n.text AS detail, n.basis AS source_ref, n.display_name, n.created_at FROM notes n JOIN temples t ON t.id = n.temple_id WHERE n.approval = 'pending'"),
    ]);
    return { items: [...f.rows, ...n.rows, ...no.rows].sort((a, b) => a.created_at - b.created_at) };
  });

  async function decide(c, a, kind, id, decision, reason) {
    const table = TABLES[kind], entity = ENTITY[kind];
    const row = (await c.query(`SELECT * FROM ${table} WHERE id = $1 AND approval = 'pending' FOR UPDATE`, [id])).rows[0];
    if (!row) return null;
    if (decision === 'reject') {
      const nw = (await c.query(`UPDATE ${table} SET approval = 'rejected', reject_reason = $2 WHERE id = $1 RETURNING *`, [id, reason || null])).rows[0];
      await log(c, a, entity, String(id), 'reject', row, nw); return 'rejected';
    }
    if (kind === 'field') { const { old, nw } = await publishField(c, row); await log(c, a, entity, String(id), 'approve', old, nw); }
    else { const nw = (await c.query(`UPDATE ${table} SET approval = 'approved' WHERE id = $1 RETURNING *`, [id])).rows[0]; await log(c, a, entity, String(id), 'approve', row, nw); }
    return 'approved';
  }
  app.post('/api/admin/pending/:kind/:id/decide', async (req, reply) => {
    const a = await needAdmin(req, reply); if (!a) return;
    if (!TABLES[req.params.kind]) return bad(reply, 'Unknown kind.');
    const decision = req.body?.decision, reason = clean(req.body?.reason, 300);
    if (!['approve', 'reject'].includes(decision)) return bad(reply, 'Decision must be approve or reject.');
    const r = await tx(c => decide(c, a, req.params.kind, req.params.id, decision, reason));
    if (!r) return bad(reply, 'Nothing pending with that id (already decided?).', 404);
    return { ok: true, result: r };
  });
  app.post('/api/admin/pending/approve-all', async (req, reply) => {
    const a = await needAdmin(req, reply); if (!a) return;
    let n = 0;
    for (const kind of Object.keys(TABLES)) {
      const ids = (await q(`SELECT id FROM ${TABLES[kind]} WHERE approval = 'pending' ORDER BY created_at`)).rows.map(r => r.id);
      for (const id of ids) if (await tx(c => decide(c, a, kind, id, 'approve'))) n++;
    }
    return { ok: true, approved: n };
  });

  app.get('/api/admin/edits', async (req, reply) => {
    if (!(await needAdmin(req, reply))) return;
    const r = await q('SELECT id, at, actor_name, entity, entity_id, action, before, after, revert_of FROM edits ORDER BY id DESC LIMIT 200');
    return { edits: r.rows };
  });

  app.post('/api/admin/edits/:id/revert', async (req, reply) => {
    const a = await needAdmin(req, reply); if (!a) return;
    return tx(async c => {
      const e = (await c.query('SELECT * FROM edits WHERE id = $1', [req.params.id])).rows[0];
      if (!e) return bad(reply, 'Unknown edit.', 404);
      if (['revert', 'submit', 'reject'].includes(e.action)) return bad(reply, 'Only a change that went live can be reverted.');
      if ((await c.query('SELECT 1 FROM edits WHERE revert_of = $1', [e.id])).rowCount) return bad(reply, 'This edit was already reverted.', 409);
      if (e.entity === 'field_value') {
        await c.query('UPDATE field_values SET current = false WHERE temple_id = $1 AND field_key = $2 AND current', [e.after.temple_id, e.after.field_key]);
        if (e.before) await c.query('UPDATE field_values SET current = true WHERE id = $1', [e.before.id]);
      } else if (e.entity === 'needs_report') {
        if (e.action === 'create') await c.query('DELETE FROM needs_reports WHERE id = $1', [e.entity_id]);
        else if (e.action === 'approve') await c.query("UPDATE needs_reports SET approval = 'rejected', reject_reason = 'Reverted by an admin' WHERE id = $1", [e.entity_id]);
        else await c.query('UPDATE needs_reports SET status = $2 WHERE id = $1', [e.entity_id, e.before.status]);
      } else if (e.entity === 'note') {
        await c.query('UPDATE notes SET hidden = true WHERE id = $1', [e.entity_id]);
      } else if (e.entity === 'comment') {
        await c.query('UPDATE comments SET hidden = $2, hidden_by = NULL WHERE id = $1', [e.entity_id, !!e.before?.hidden]);
      } else if (e.entity === 'setting') {
        await setRequireApproval(!!e.before?.requireApproval, a.id);
      } else return bad(reply, 'Cannot revert this kind of edit.');
      await log(c, a, e.entity, e.entity_id, 'revert', e.after, e.before, e.id);
      return { ok: true };
    });
  });

  app.post('/api/admin/comments/:id/hide', async (req, reply) => {
    const a = await needAdmin(req, reply); if (!a) return;
    const hide = req.body?.hidden !== false;
    return tx(async c => {
      const old = (await c.query('SELECT id, temple_id, item_key, text, hidden FROM comments WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!old) return bad(reply, 'Unknown comment.', 404);
      await c.query('UPDATE comments SET hidden = $2, hidden_by = $3 WHERE id = $1', [old.id, hide, hide ? a.id : null]);
      await log(c, a, 'comment', old.id, hide ? 'hide' : 'restore', old, { ...old, hidden: hide });
      return { ok: true, hidden: hide };
    });
  });
}
