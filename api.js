/* window.Api: the ONLY data-access layer for community data, volunteer edits and sign-in.
   Two adapters with one contract:
     server  - talks to the Node/Postgres API (shared by everyone)       used when /api/health answers
     local   - keeps everything in this browser (demo on static hosting)  used otherwise
   Every method is async and rejects with an Error that has .message (safe to show), .status and .code. */
(() => {
const fail = (msg, status = 400, code) => Object.assign(new Error(msg), { status, code });
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
const today = () => new Date().toISOString().slice(0, 10);
let adapter = null, mode = 'local', lastMe = { user: null, signIn: {} };

/* ---------------- server adapter ---------------- */
async function call(method, path, body) {
  const r = await fetch(path, { method, credentials: 'same-origin', headers: body !== undefined ? { 'content-type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok) throw fail(j?.error || 'Something went wrong. Try again.', r.status, j?.code);
  return j;
}
const normNeed = n => ({ id: n.id, templeId: n.temple_id, templeName: n.temple_name, state: n.state, district: n.district, category: n.category, area: n.area, severity: n.severity, title: n.title, description: n.description, observedOn: String(n.observed_on).slice(0, 10), evidence: n.evidence, status: n.status, approval: n.approval || 'approved', by: n.display_name, at: n.created_at });
const qs = o => { const p = new URLSearchParams(Object.entries(o || {}).filter(([, v]) => v)); return p.toString() ? '?' + p : ''; };
const server = {
  me: () => call('GET', '/api/me'),
  signIn: (email, displayName) => call('POST', '/api/auth/sign-in', { email, displayName }),   // name + email stored, not verified (temporary)
  // EMAIL VERIFICATION (disabled for now): requestLink: (email, displayName) => call('POST', '/api/auth/request-link', { email, displayName }),
  devAdmin: () => call('POST', '/api/auth/dev-admin', {}),
  logout: () => call('POST', '/api/auth/logout', {}),
  community: id => call('GET', '/api/community/' + encodeURIComponent(id)),
  rate: (templeId, itemKey, stars, o = {}) => call('POST', '/api/ratings', { templeId, itemKey, stars, displayName: o.name, email: o.email, consent: !!o.consent, website: o.website }),
  comment: (templeId, itemKey, text, o = {}) => call('POST', '/api/comments', { templeId, itemKey, text, displayName: o.name, email: o.email, consent: !!o.consent, website: o.website }),
  upvote: commentId => call('POST', '/api/upvotes', { commentId }),
  summary: () => call('GET', '/api/community-summary'),
  getFields: id => call('GET', '/api/fields/' + encodeURIComponent(id)),
  saveField: v => call('POST', '/api/fields', v),
  needs: async f => (await call('GET', '/api/needs' + qs(f))).reports.map(normNeed),
  addNeed: v => call('POST', '/api/needs', v),
  setNeedStatus: (id, status) => call('POST', `/api/needs/${id}/status`, { status }),
  notes: async id => (await call('GET', '/api/notes/' + encodeURIComponent(id))).notes.map(n => ({ id: n.id, type: n.type, text: n.text, basis: n.basis, approval: n.approval || 'approved', by: n.display_name, at: n.created_at })),
  addNote: v => call('POST', '/api/notes', v),
  adminEdits: async () => (await call('GET', '/api/admin/edits')).edits,
  settings: () => call('GET', '/api/admin/settings'),
  setSettings: requireApproval => call('POST', '/api/admin/settings', { requireApproval }),
  pending: async () => (await call('GET', '/api/admin/pending')).items,
  decide: (kind, id, decision, reason) => call('POST', `/api/admin/pending/${kind}/${encodeURIComponent(id)}/decide`, { decision, reason }),
  approveAll: () => call('POST', '/api/admin/pending/approve-all', {}),
  mySubmissions: async () => (await call('GET', '/api/my-submissions')).items,
  revert: id => call('POST', `/api/admin/edits/${id}/revert`, {}),
  hideComment: (id, hidden) => call('POST', `/api/admin/comments/${id}/hide`, { hidden }),
};

/* ---------------- local adapter (static hosting / demo) ---------------- */
const KEY = 'temple-local-v2';
let mem = null;
const db = () => {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  mem ||= { me: null, ratings: {}, comments: [], upvotes: {}, fields: [], needs: [], notes: [], edits: [], last: 0 };
  mem.settings ||= { requireApproval: false };
  return mem;
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* storage unavailable: keep in memory */ } };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const needMe = () => { const m = db().me; if (!m) throw fail('Sign in as a volunteer to add or edit data.', 401, 'SIGN_IN_REQUIRED'); return m; };
const goesLive = d => d.me?.role === 'admin' || !d.settings.requireApproval;
const logEdit = (entity, entityId, action, before, after, revertOf = null) => { const d = db(); d.edits.unshift({ id: d.edits.length + 1, at: new Date().toISOString(), actor_name: d.me?.name, entity, entity_id: String(entityId), action, before, after, revert_of: revertOf }); };
let schemaP = null, catsP = null;
const needCats = () => (catsP ||= fetch('data/need-categories.json').then(r => r.json()).then(j => new Set([...j.categories.map(c => c.key), ...Object.keys(j.legacy)])));
const schemas = () => (schemaP ||= Promise.all([fetch('data/facilities-checklist.json').then(r => r.json()), fetch('data/field-schema.json').then(r => r.json())]).then(([c, f]) => ({ items: new Set(c.groups.flatMap(g => g.items.map(i => i.key))), fields: new Map(f.groups.flatMap(g => g.fields.map(x => [x.key, x]))), sources: f.sources })));
const itemStats = (d, t, k) => { const v = Object.entries(d.ratings).filter(([key]) => key.startsWith(t + '|' + k)).map(([, r]) => r.stars); return { count: v.length, avg: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100 : null }; };

const local = {
  me: async () => ({ user: db().me && { name: db().me.name, role: db().me.role }, approvalRequired: !!db().settings.requireApproval, signIn: { email: false, dev: true, local: true } }),
  signIn: async (email, name) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw fail('Enter a valid email address.');
    if (clean(name, 40).length < 2) throw fail('Enter a display name (2-40 characters).');
    db().me = { name: clean(name, 40), email, role: 'volunteer', demo: true }; save();      // demo sign-in: not verified
    return { ok: true, sent: false, signedIn: true };
  },
  devAdmin: async () => { db().me = { name: 'Demo admin', email: 'admin@demo.local', role: 'admin', demo: true }; save(); return { ok: true }; },
  logout: async () => { db().me = null; save(); return { ok: true }; },
  community: async id => {
    const d = db(), items = {};
    for (const [key, r] of Object.entries(d.ratings)) { const [t, k] = key.split('|'); if (t === id) items[k] = { ...itemStats(d, id, k), mine: r.stars, comments: [] }; }
    for (const c of d.comments.filter(c => c.templeId === id && (!c.hidden || d.me?.role === 'admin')).sort((a, b) => (d.upvotes[b.id] ? 1 : 0) - (d.upvotes[a.id] ? 1 : 0) || b.at.localeCompare(a.at)))
      (items[c.itemKey] ||= { avg: null, count: 0, mine: null, comments: [] }).comments.push({ id: c.id, text: c.text, name: c.name || 'Visitor', at: c.at, upvotes: d.upvotes[c.id] ? 1 : 0, upvoted: !!d.upvotes[c.id], mine: true, hidden: !!c.hidden });
    return { items };
  },
  rate: async (templeId, itemKey, stars, o = {}) => {
    const s = await schemas(); stars = Number(stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw fail('Stars must be a whole number from 1 to 5.');
    if (!s.items.has(itemKey)) throw fail('Unknown checklist item.');
    const d = db(); d.ratings[templeId + '|' + itemKey] = { stars, at: Date.now() }; save();
    return { ok: true, ...itemStats(d, templeId, itemKey), mine: stars };
  },
  comment: async (templeId, itemKey, text, o = {}) => {
    const s = await schemas(), d = db(); text = clean(text, 600).replace(/\s*\n\s*/g, ' ');
    if (!s.items.has(itemKey)) throw fail('Unknown checklist item.');
    if (text.length < 5 || text.length > 500) throw fail('A comment must be 5 to 500 characters.');
    if (Date.now() - d.last < 20000) throw fail('Please wait a few seconds before posting another comment.', 429);
    const mine = d.comments.filter(c => c.templeId === templeId);
    if (mine.some(c => c.text.toLowerCase() === text.toLowerCase())) throw fail('You already posted this comment.', 409);
    if (mine.length >= 5) throw fail('You can post at most 5 comments per temple.', 429);
    const c = { id: uid(), templeId, itemKey, text, name: clean(o.name, 40) || null, at: new Date().toISOString() };
    d.comments.push(c); d.last = Date.now(); save();
    return { ok: true, comment: { id: c.id, text, name: c.name || 'Visitor', at: c.at, upvotes: 0, upvoted: false, mine: true } };
  },
  upvote: async commentId => {          // demo only: the local adapter has one visitor, so own comments may be upvoted
    const d = db(); if (!d.comments.some(c => c.id === commentId)) throw fail('Unknown comment.', 404);
    d.upvotes[commentId] ? delete d.upvotes[commentId] : (d.upvotes[commentId] = 1); save();
    return { ok: true, upvoted: !!d.upvotes[commentId], upvotes: d.upvotes[commentId] ? 1 : 0 };
  },
  summary: async () => {
    const d = db(), byT = {}, byI = {};
    for (const [key, r] of Object.entries(d.ratings)) { const [t, k] = key.split('|'); (byT[t] ||= []).push(r.stars); (byI[k] ||= []).push(r.stars); }
    const name = id => (typeof temples === 'function' ? temples().find(x => x.id === id) : null);
    const topRated = Object.entries(byT).filter(([, v]) => v.length >= 3).map(([id, v]) => { const t = name(id); return { id, name: t?.name || id, state: t?.state, district: t?.district, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100, n: v.length }; }).sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 12);
    const mostUpvoted = d.comments.filter(c => d.upvotes[c.id] && !c.hidden).map(c => { const t = name(c.templeId); return { id: c.id, text: c.text, item_key: c.itemKey, temple_id: c.templeId, name: t?.name || c.templeId, state: t?.state, upvotes: 1 }; }).slice(0, 12);
    return { minRatings: 3, topRated, mostUpvoted, items: Object.entries(byI).map(([k, v]) => ({ item_key: k, n: v.length, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100 })), totals: { ratings: Object.keys(d.ratings).length, comments: d.comments.filter(c => !c.hidden).length, temples: Object.keys(byT).length } };
  },
  getFields: async id => {
    const map = f => ({ id: f.id, key: f.fieldKey, value: f.value, sourceType: f.sourceType, sourceRef: f.sourceRef, checkedOn: f.checkedOn, by: f.by, at: f.at });
    return { values: db().fields.filter(f => f.templeId === id && f.current).map(map), pending: db().fields.filter(f => f.templeId === id && f.approval === 'pending').map(map) };
  },
  saveField: async v => {
    const m = needMe(), s = await schemas(), f = s.fields.get(v.fieldKey), d = db();
    if (!f) throw fail('Unknown field.');
    const value = clean(v.value, 500), ref = clean(v.sourceRef, 300);
    if (!value) throw fail('Enter the value.');
    if (f.type === 'url' && !/^https?:\/\//i.test(value)) throw fail('Enter a valid web link (https://…).');
    if (!f.sources.includes(v.sourceType)) throw fail('Choose one of the accepted source types for this field.');
    if (!ref) throw fail('Add the source: a link, or where and when you saw it.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.checkedOn || '') || v.checkedOn > today()) throw fail('Enter the date you checked this (not in the future).');
    const live = goesLive(d);
    d.fields = d.fields.filter(x => !(x.templeId === v.templeId && x.fieldKey === v.fieldKey && x.approval === 'pending' && x.by === m.name));
    const nw = { id: uid(), templeId: v.templeId, fieldKey: v.fieldKey, value, sourceType: v.sourceType, sourceRef: ref, checkedOn: v.checkedOn, by: m.name, at: new Date().toISOString(), current: false, approval: live ? 'approved' : 'pending' };
    d.fields.push(nw);
    if (!live) { logEdit('field_value', nw.id, 'submit', null, nw); save(); return { ok: true, id: nw.id, by: m.name, pending: true }; }
    const old = d.fields.find(x => x.templeId === v.templeId && x.fieldKey === v.fieldKey && x.current); if (old) old.current = false;
    nw.current = true; logEdit('field_value', nw.id, old ? 'update' : 'create', old || null, nw); save();
    return { ok: true, id: nw.id, by: m.name, pending: false };
  },
  needs: async f => { f = f || {}; return db().needs.filter(n => n.approval !== 'rejected' && (!f.templeId || n.templeId === f.templeId) && (!f.state || n.state === f.state) && (!f.status || n.status === f.status) && (!f.category || n.category === f.category)); },
  addNeed: async v => {
    const m = needMe(), d = db();
    const title = clean(v.title, 100), desc = clean(v.description, 800), area = clean(v.area, 60), ev = clean(v.evidence, 300);
    if (!(await needCats()).has(v.category)) throw fail('Choose a category.');
    if (!['Low', 'Medium', 'High'].includes(v.severity)) throw fail('Choose a severity.');
    if (!title || desc.length < 20 || !area) throw fail('Add a title, the place, and at least 20 characters describing what you saw.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.observedOn || '') || v.observedOn > today()) throw fail('Enter the date you saw it (not in the future).');
    if (ev && !/^https?:\/\//i.test(ev)) throw fail('Evidence must be a valid web link.');
    const t = typeof temples === 'function' ? temples().find(x => x.id === v.templeId) : null;
    const n = { id: uid(), templeId: v.templeId, templeName: t?.name || v.templeId, state: t?.state, district: t && t.district !== 'Not recorded' ? t.district : '', category: v.category, area, severity: v.severity, title, description: desc, observedOn: v.observedOn, evidence: ev || null, status: 'Open', by: m.name, at: new Date().toISOString(), approval: goesLive(d) ? 'approved' : 'pending' };
    d.needs.unshift(n); logEdit('needs_report', n.id, n.approval === 'approved' ? 'create' : 'submit', null, n); save(); return { ok: true, id: n.id, pending: n.approval === 'pending' };
  },
  setNeedStatus: async (id, status) => {
    needMe(); if (!goesLive(db())) throw fail('While admin approval is on, only an admin can change a report’s status.', 403); const n = db().needs.find(x => x.id === id && x.approval === 'approved'); if (!n) throw fail('Unknown report.', 404);
    if (!['Open', 'In progress', 'Resolved'].includes(status)) throw fail('Unknown status.');
    const before = { ...n }; n.status = status; logEdit('needs_report', id, 'update', before, { ...n }); save(); return { ok: true };
  },
  notes: async id => db().notes.filter(n => n.templeId === id && !n.hidden && n.approval !== 'rejected'),
  addNote: async v => {
    const m = needMe(), text = clean(v.text, 600), basis = clean(v.basis, 200), type = clean(v.type, 40);
    if (text.length < 15) throw fail('Write at least 15 characters.');
    if (!basis) throw fail('Say how you know this (visit date, temple notice or a link).');
    if (!type) throw fail('Choose a topic.');
    const n = { id: uid(), templeId: v.templeId, type, text, basis, by: m.name, at: new Date().toISOString(), approval: goesLive(db()) ? 'approved' : 'pending' };
    db().notes.unshift(n); logEdit('note', n.id, n.approval === 'approved' ? 'create' : 'submit', null, n); save(); return { ok: true, id: n.id, pending: n.approval === 'pending' };
  },
  adminEdits: async () => { if (db().me?.role !== 'admin') throw fail('Admin only.', 403); return db().edits; },
  settings: async () => { if (db().me?.role !== 'admin') throw fail('Admin only.', 403); return { requireApproval: !!db().settings.requireApproval }; },
  setSettings: async v => {
    if (db().me?.role !== 'admin') throw fail('Admin only.', 403);
    const before = !!db().settings.requireApproval; db().settings.requireApproval = !!v; logEdit('setting', 'require_approval', 'update', { requireApproval: before }, { requireApproval: !!v }); save(); return { ok: true, requireApproval: !!v };
  },
  pending: async () => {
    if (db().me?.role !== 'admin') throw fail('Admin only.', 403); const d = db(), nm = id => (typeof temples === 'function' ? temples().find(x => x.id === id)?.name : null) || id;
    return [...d.fields.filter(f => f.approval === 'pending').map(f => ({ id: f.id, kind: 'field', temple_id: f.templeId, temple: nm(f.templeId), title: f.fieldKey, detail: f.value, source_ref: f.sourceRef, display_name: f.by, created_at: f.at })),
      ...d.needs.filter(n => n.approval === 'pending').map(n => ({ id: n.id, kind: 'need', temple_id: n.templeId, temple: n.templeName, title: n.title, detail: n.description, source_ref: n.evidence, display_name: n.by, created_at: n.at })),
      ...d.notes.filter(n => n.approval === 'pending').map(n => ({ id: n.id, kind: 'note', temple_id: n.templeId, temple: nm(n.templeId), title: n.type, detail: n.text, source_ref: n.basis, display_name: n.by, created_at: n.at }))].sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  decide: async (kind, id, decision, reason) => {
    if (db().me?.role !== 'admin') throw fail('Admin only.', 403);
    const d = db(), list = kind === 'field' ? d.fields : kind === 'need' ? d.needs : d.notes, row = list.find(x => x.id === id && x.approval === 'pending');
    if (!row) throw fail('Nothing pending with that id (already decided?).', 404);
    const entity = { field: 'field_value', need: 'needs_report', note: 'note' }[kind], before = { ...row };
    if (decision === 'reject') { row.approval = 'rejected'; row.rejectReason = clean(reason, 300) || null; logEdit(entity, id, 'reject', before, { ...row }); save(); return { ok: true, result: 'rejected' }; }
    let old = null;
    if (kind === 'field') { old = d.fields.find(x => x.templeId === row.templeId && x.fieldKey === row.fieldKey && x.current && x.id !== row.id) || null; if (old) old.current = false; row.current = true; }
    row.approval = 'approved'; logEdit(entity, id, 'approve', kind === 'field' ? old : before, { ...row }); save(); return { ok: true, result: 'approved' };
  },
  approveAll: async () => { const q = await local.pending(); let n = 0; for (const it of q) { await local.decide(it.kind, it.id, 'approve'); n++; } return { ok: true, approved: n }; },
  mySubmissions: async () => { needMe(); const d = db(), nm = id => (typeof temples === 'function' ? temples().find(x => x.id === id)?.name : null) || id;
    return [...d.fields.map(f => ({ id: f.id, kind: 'field', temple: nm(f.templeId), title: f.fieldKey, detail: f.value, approval: f.approval || 'approved', reject_reason: f.rejectReason, created_at: f.at })),
      ...d.needs.map(n => ({ id: n.id, kind: 'need', temple: n.templeName, title: n.title, detail: n.description, approval: n.approval || 'approved', reject_reason: n.rejectReason, created_at: n.at })),
      ...d.notes.map(n => ({ id: n.id, kind: 'note', temple: nm(n.templeId), title: n.type, detail: n.text, approval: n.approval || 'approved', reject_reason: n.rejectReason, created_at: n.at }))].sort((a, b) => b.created_at.localeCompare(a.created_at)); },
  revert: async id => {
    if (db().me?.role !== 'admin') throw fail('Admin only.', 403);
    const d = db(), e = d.edits.find(x => x.id === id); if (!e) throw fail('Unknown edit.', 404);
    if (['revert', 'submit', 'reject'].includes(e.action)) throw fail('Only a change that went live can be reverted.');
    if (d.edits.some(x => x.revert_of === id)) throw fail('This edit was already reverted.', 409);
    if (e.entity === 'field_value') { const cur = d.fields.find(f => f.id === e.after.id); if (cur) cur.current = false; if (e.before) { const p = d.fields.find(f => f.id === e.before.id); if (p) p.current = true; } }
    else if (e.entity === 'needs_report') { if (e.action === 'create') d.needs = d.needs.filter(n => n.id !== e.entity_id); else if (e.action === 'approve') { const n = d.needs.find(x => x.id === e.entity_id); if (n) n.approval = 'rejected'; } else { const n = d.needs.find(x => x.id === e.entity_id); if (n) n.status = e.before.status; } }
    else if (e.entity === 'setting') d.settings.requireApproval = !!e.before?.requireApproval
    else if (e.entity === 'note') { const n = d.notes.find(x => x.id === e.entity_id); if (n) n.hidden = true; }
    else if (e.entity === 'comment') { const c = d.comments.find(x => x.id === e.entity_id); if (c) c.hidden = !!e.before?.hidden; }
    logEdit(e.entity, e.entity_id, 'revert', e.after, e.before, id); save(); return { ok: true };
  },
  hideComment: async (id, hidden) => {
    if (db().me?.role !== 'admin') throw fail('Admin only.', 403);
    const c = db().comments.find(x => x.id === id); if (!c) throw fail('Unknown comment.', 404);
    const before = { ...c }; c.hidden = hidden !== false; logEdit('comment', id, c.hidden ? 'hide' : 'restore', before, { ...c }); save(); return { ok: true, hidden: c.hidden };
  },
};

/* ---------------- public surface ---------------- */
const ready = (async () => {
  try {
    const r = await fetch('/api/health', { credentials: 'same-origin' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json') && (await r.json()).ok) { adapter = server; mode = 'server'; }
  } catch { /* no server: static hosting */ }
  adapter ||= local;
  try { lastMe = await adapter.me(); } catch { lastMe = { user: null, signIn: {} }; }
  syncRole();
})();
function syncRole() { try { role = lastMe.user?.role === 'admin' ? 'admin' : 'member'; } catch { /* role not defined yet */ } }
// Only an actual sign-in or sign-out announces a session change.
const wrap = name => async (...a) => { await ready; const r = await adapter[name](...a); if (name === 'devAdmin' || name === 'logout' || name === 'signIn') { lastMe = await adapter.me(); syncRole(); document.dispatchEvent(new CustomEvent('api:session')); } return r; };
const api = { ready, get mode() { return mode; }, get user() { return lastMe.user; }, get signInInfo() { return lastMe.signIn || {}; }, get isAdmin() { return lastMe.user?.role === 'admin'; }, get approvalRequired() { return !!lastMe.approvalRequired; } };
for (const name of Object.keys(local)) api[name] = wrap(name);
api.refreshMe = async () => { await ready; lastMe = await adapter.me(); syncRole(); document.dispatchEvent(new CustomEvent('api:session')); return lastMe; };
window.Api = api;
})();
