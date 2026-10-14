// Integration tests against a running server with DEV_LINKS=1:  BASE=http://localhost:8080 npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8080';
const TEMPLE = 'osm-node-398040821';
const stamp = Date.now().toString(36);

// A tiny cookie-keeping client = one "browser".
function browser() {
  const jar = {};
  return async function call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method, redirect: 'manual',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...headers },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  };
}
const A = browser(), B = browser(), V = browser(), ADMIN = browser(), ANON = browser();
let commentId, fieldEditId;

test('health and data are present', async () => {
  const r = await A('GET', '/api/health');
  assert.equal(r.status, 200); assert.equal(r.json.temples, 41369);
});

test('anyone can rate without signing in; one rating per browser per item', async () => {
  let r = await A('POST', '/api/ratings', { templeId: TEMPLE, itemKey: 'dustbins', stars: 4 });
  assert.equal(r.status, 200); assert.equal(r.json.count, 1); assert.equal(r.json.avg, 4);
  r = await A('POST', '/api/ratings', { templeId: TEMPLE, itemKey: 'dustbins', stars: 2 });   // re-rate replaces
  assert.equal(r.json.count, 1); assert.equal(r.json.avg, 2);
  r = await B('POST', '/api/ratings', { templeId: TEMPLE, itemKey: 'dustbins', stars: 5 });   // second browser
  assert.equal(r.json.count, 2); assert.equal(r.json.avg, 3.5);
});

test('rating validation and honeypot', async () => {
  assert.equal((await A('POST', '/api/ratings', { templeId: TEMPLE, itemKey: 'dustbins', stars: 6 })).status, 400);
  assert.equal((await A('POST', '/api/ratings', { templeId: TEMPLE, itemKey: 'dustbins', stars: 2.5 })).status, 400);
  assert.equal((await A('POST', '/api/ratings', { templeId: TEMPLE, itemKey: 'nope', stars: 3 })).status, 400);
  assert.equal((await A('POST', '/api/ratings', { templeId: 'osm-node-0', itemKey: 'toilets', stars: 3 })).status, 404);
  const hp = await A('POST', '/api/ratings', { templeId: TEMPLE, itemKey: 'lighting', stars: 5, website: 'http://spam' });
  assert.equal(hp.json.ok, true);
  const c = await A('GET', `/api/community/${TEMPLE}`);
  assert.equal(c.json.items.lighting, undefined, 'honeypot submission must not be stored');
  assert.equal(c.json.items.dustbins.mine, 2);
});

test('comments: length, plain text, cooldown, duplicate', async () => {
  assert.equal((await A('POST', '/api/comments', { templeId: TEMPLE, itemKey: 'toilets', text: 'bad' })).status, 400);
  const xss = '<img src=x onerror=alert(1)> bins are always full';
  let r = await A('POST', '/api/comments', { templeId: TEMPLE, itemKey: 'toilets', text: xss, displayName: 'Asha' });
  assert.equal(r.status, 200); commentId = r.json.comment.id;
  assert.equal(r.json.comment.text, xss, 'stored as plain text; the client escapes it');
  r = await A('POST', '/api/comments', { templeId: TEMPLE, itemKey: 'toilets', text: 'another comment right away' });
  assert.equal(r.status, 429, 'cooldown');
  assert.equal((await A('POST', '/api/comments', { templeId: TEMPLE, itemKey: 'toilets', text: 'x'.repeat(501) })).status, 400);
  await new Promise(r => setTimeout(r, 20500));
  r = await A('POST', '/api/comments', { templeId: TEMPLE, itemKey: 'toilets', text: xss });
  assert.equal(r.status, 409, 'duplicate');
});

test('upvote only: toggles, no self-upvote, no downvote', async () => {
  let r = await B('POST', '/api/upvotes', { commentId });
  assert.equal(r.json.upvoted, true); assert.equal(r.json.upvotes, 1);
  r = await B('POST', '/api/upvotes', { commentId });
  assert.equal(r.json.upvoted, false); assert.equal(r.json.upvotes, 0);
  await B('POST', '/api/upvotes', { commentId });
  assert.equal((await A('POST', '/api/upvotes', { commentId })).status, 403, 'own comment');
  assert.equal((await B('POST', '/api/downvotes', { commentId })).status, 404, 'no downvote endpoint');
  const c = await B('GET', `/api/community/${TEMPLE}`);
  const cm = c.json.items.toilets.comments.find(x => x.id === commentId);
  assert.equal(cm.upvotes, 1); assert.equal(cm.upvoted, true); assert.equal(cm.mine, false);
});

test('writes must be JSON (CSRF guard)', async () => {
  const r = await A('POST', '/api/ratings', 'templeId=x', { 'content-type': 'text/plain' });
  assert.equal(r.status, 415);
});

test('adding data needs sign-in', async () => {
  const field = { templeId: TEMPLE, fieldKey: 'dress_code', value: 'Modest clothing', sourceType: 'visit', sourceRef: 'Notice board', checkedOn: '2026-10-08' };
  for (const [p, b] of [['/api/fields', field], ['/api/needs', {}], ['/api/notes', {}]]) {
    const r = await ANON('POST', p, b);
    assert.equal(r.status, 401, p); assert.equal(r.json.code, 'SIGN_IN_REQUIRED');
  }
  assert.equal((await ANON('GET', '/api/admin/edits')).status, 401);
});

test('simple sign-in (name + email, no verification), then volunteer edits go live and are logged', async () => {
  const email = `vol-${stamp}@example.com`;
  assert.equal((await V('POST', '/api/auth/sign-in', { email: 'nope', displayName: 'Asha' })).status, 400);
  assert.equal((await V('POST', '/api/auth/sign-in', { email, displayName: 'A' })).status, 400, 'name too short');
  let r = await V('POST', '/api/auth/sign-in', { email, displayName: 'Asha Volunteer' });
  assert.equal(r.status, 200);
  const me = await V('GET', '/api/me');
  assert.equal(me.json.user.name, 'Asha Volunteer'); assert.equal(me.json.user.role, 'volunteer');

  const base = { templeId: TEMPLE, fieldKey: 'dress_code', value: 'Modest clothing; shoulders covered', sourceType: 'visit', sourceRef: 'Notice board at the entrance', checkedOn: '2026-10-08' };
  assert.equal((await V('POST', '/api/fields', { ...base, checkedOn: '2999-01-01' })).status, 400, 'future date');
  assert.equal((await V('POST', '/api/fields', { ...base, sourceType: 'asi' })).status, 400, 'source type not accepted for this field');
  assert.equal((await V('POST', '/api/fields', { ...base, fieldKey: 'nope' })).status, 400);
  assert.equal((await V('POST', '/api/fields', { ...base, sourceRef: '' })).status, 400, 'source required');
  r = await V('POST', '/api/fields', base);
  assert.equal(r.status, 200); assert.equal(r.json.by, 'Asha Volunteer');
  const got = await ANON('GET', `/api/fields/${TEMPLE}`);
  assert.equal(got.json.values.find(x => x.key === 'dress_code').by, 'Asha Volunteer');

  const need = await V('POST', '/api/needs', { templeId: TEMPLE, category: 'water', area: 'Temple tank or pond', severity: 'High', title: 'Algae in tank', description: 'Green algae covers the tank and plastic floats near the steps.', observedOn: '2026-10-10' });
  assert.equal(need.status, 200);
  const ok = { templeId: TEMPLE, category: 'puja-waste', area: 'Prakaram (circumambulation path)', severity: 'Low', title: 'Flower waste in the prakaram', description: 'Garlands and coconut shells are left in the circumambulation path.', observedOn: '2026-10-10' };
  assert.equal((await V('POST', '/api/needs', ok)).status, 200, 'temple-specific category accepted');
  assert.equal((await V('POST', '/api/needs', { ...ok, category: 'potholes' })).status, 400, 'unknown category rejected');
  assert.equal((await V('POST', '/api/notes', { templeId: TEMPLE, type: 'Dress code', text: 'Cover shoulders and knees inside.', basis: 'Visited 8 Oct 2026' })).status, 200);
  assert.equal((await ANON('GET', `/api/needs?templeId=${TEMPLE}`)).json.reports.length, 2);
});

test('dummy admin: audit log, revert, hide comment; volunteers are not admins', async () => {
  assert.equal((await V('GET', '/api/admin/edits')).status, 403);
  assert.equal((await ADMIN('POST', '/api/auth/dev-admin', {})).status, 200);
  const log = await ADMIN('GET', '/api/admin/edits');
  const edit = log.json.edits.find(e => e.entity === 'field_value' && e.action === 'create');
  assert.ok(edit, 'volunteer edit is in the audit log'); fieldEditId = edit.id;
  assert.equal((await ADMIN('POST', `/api/admin/edits/${fieldEditId}/revert`, {})).status, 200);
  assert.equal((await ANON('GET', `/api/fields/${TEMPLE}`)).json.values.find(x => x.key === 'dress_code'), undefined, 'revert removes the value');
  assert.equal((await ADMIN('POST', `/api/admin/edits/${fieldEditId}/revert`, {})).status, 409, 'already reverted');

  assert.equal((await ADMIN('POST', `/api/admin/comments/${commentId}/hide`, { hidden: true })).status, 200);
  const hidden = await B('GET', `/api/community/${TEMPLE}`);
  assert.equal(hidden.json.items.toilets?.comments.find(x => x.id === commentId), undefined, 'hidden from visitors');
  const adminView = await ADMIN('GET', `/api/community/${TEMPLE}`);
  assert.equal(adminView.json.items.toilets.comments.find(x => x.id === commentId).hidden, true, 'admin still sees it');
  await ADMIN('POST', `/api/admin/comments/${commentId}/hide`, { hidden: false });
});

test('home summary reflects only real data', async () => {
  const r = await A('GET', '/api/community-summary');
  assert.equal(r.json.minRatings, 3);
  assert.equal(r.json.topRated.length, 0, 'a temple needs 3 ratings to rank');
  assert.ok(r.json.mostUpvoted.some(x => x.upvotes >= 1));
});

test('exports are complete and never contain an email', async () => {
  const email = `leak-${stamp}@example.com`;
  await new Promise(r => setTimeout(r, 100));
  const C = browser();
  await C('POST', '/api/ratings', { templeId: TEMPLE, itemKey: 'first-aid', stars: 3, email, consent: true });
  const nd = (await ANON('GET', '/api/export/temples.ndjson')).text.trim().split('\n');
  assert.equal(nd.length, 41369); assert.ok(JSON.parse(nd[0]).id.startsWith('osm-'));
  const csv = (await ANON('GET', '/api/export/temples.csv')).text.trim().split('\n');
  assert.ok(csv.length >= 41370, 'header + one row per temple (quoted newlines allowed)');
  const geo = JSON.parse((await ANON('GET', '/api/export/temples.geojson')).text);
  assert.equal(geo.features.length, 41369); assert.equal(geo.features[0].geometry.type, 'Point');
  const com = (await ANON('GET', '/api/export/community.json')).text;
  assert.ok(!com.includes(email) && !com.includes('@example.com'), 'no email in the community export');
  for (const r of ['/api/temples/' + TEMPLE, '/api/community/' + TEMPLE, '/api/community-summary', '/api/needs', '/api/admin/edits'])
    assert.ok(!(await ANON('GET', r)).text.includes('@example.com'), r + ' must not expose emails');
});

test('admin approval: bypass is the default; switching it on queues volunteer changes; admins publish directly', async () => {
  const V2 = browser();
  const email = `vol2-${stamp}@example.com`;
  let r = await V2('POST', '/api/auth/sign-in', { email, displayName: 'Ravi Volunteer' });
  assert.equal(r.status, 200);
  const field = { templeId: TEMPLE, fieldKey: 'phone', value: '+91 98765 43210', sourceType: 'official', sourceRef: 'Temple website contact page', checkedOn: '2026-10-09' };

  // default = bypass: live at once, no pending
  assert.equal((await V2('GET', '/api/me')).json.approvalRequired, false);
  r = await V2('POST', '/api/fields', field);
  assert.equal(r.json.pending, false);
  assert.equal((await ANON('GET', `/api/fields/${TEMPLE}`)).json.values.find(x => x.key === 'phone').value, '+91 98765 43210');
  assert.equal((await ADMIN('GET', '/api/admin/pending')).json.items.length, 0);

  // only an admin can flip the switch
  assert.equal((await V2('POST', '/api/admin/settings', { requireApproval: true })).status, 403);
  assert.equal((await ADMIN('POST', '/api/admin/settings', { requireApproval: 'yes' })).status, 400);
  assert.equal((await ADMIN('POST', '/api/admin/settings', { requireApproval: true })).status, 200);
  assert.equal((await ANON('GET', '/api/me')).json.approvalRequired, true);

  // now changes wait
  r = await V2('POST', '/api/fields', { ...field, value: '+91 11111 22222' });
  assert.equal(r.json.pending, true);
  const pubVals = (await ANON('GET', `/api/fields/${TEMPLE}`)).json;
  assert.equal(pubVals.values.find(x => x.key === 'phone').value, '+91 98765 43210', 'public still sees the approved value');
  assert.equal(pubVals.pending.length, 0, 'public never sees pending items');
  const mine = (await V2('GET', `/api/fields/${TEMPLE}`)).json;
  assert.equal(mine.pending.length, 1, 'the author sees their own pending item');

  const need = await V2('POST', '/api/needs', { templeId: TEMPLE, category: 'litter', area: 'Parking area', severity: 'Medium', title: 'Litter at the parking area', description: 'Plastic and food waste is piled up beside the parking area.', observedOn: '2026-10-11' });
  assert.equal(need.json.pending, true);
  const notesBefore = (await ANON('GET', `/api/notes/${TEMPLE}`)).json.notes.length;
  const note = await V2('POST', '/api/notes', { templeId: TEMPLE, type: 'Timings and queues', text: 'Queues are longest on Saturday mornings.', basis: 'Visited 10 Oct 2026' });
  assert.equal(note.json.pending, true);
  assert.equal((await ANON('GET', `/api/needs?templeId=${TEMPLE}`)).json.reports.every(x => x.title !== 'Litter at the parking area'), true, 'pending need hidden from the public');
  assert.equal((await ANON('GET', `/api/notes/${TEMPLE}`)).json.notes.length, notesBefore, 'pending note hidden from the public');
  assert.equal((await V2('GET', `/api/notes/${TEMPLE}`)).json.notes.length, notesBefore + 1, 'author sees own pending note');
  assert.equal((await V2('POST', `/api/needs/${need.json.id}/status`, { status: 'Resolved' })).status, 403, 'status changes need an admin while approval is on');

  // a pending item never leaks into exports
  const exp = (await ANON('GET', '/api/export/community.json')).text;
  assert.ok(!exp.includes('Litter at the parking area') && !exp.includes('+91 11111 22222') && !exp.includes('Saturday mornings'));

  // the queue
  const q = (await ADMIN('GET', '/api/admin/pending')).json.items;
  assert.deepEqual(q.map(x => x.kind).sort(), ['field', 'need', 'note']);
  assert.equal((await V2('GET', '/api/admin/pending')).status, 403);

  // approve the field: it replaces the old value and is attributed to the volunteer
  const fq = q.find(x => x.kind === 'field');
  assert.equal((await ADMIN('POST', `/api/admin/pending/field/${fq.id}/decide`, { decision: 'approve' })).status, 200);
  assert.equal((await ANON('GET', `/api/fields/${TEMPLE}`)).json.values.find(x => x.key === 'phone').value, '+91 11111 22222');
  assert.equal((await ADMIN('POST', `/api/admin/pending/field/${fq.id}/decide`, { decision: 'approve' })).status, 404, 'cannot decide twice');

  // reject the need with a reason: gone from public, visible to the author with the reason
  const nq = q.find(x => x.kind === 'need');
  assert.equal((await ADMIN('POST', `/api/admin/pending/need/${nq.id}/decide`, { decision: 'reject', reason: 'Please add a photo link' })).status, 200);
  assert.equal((await V2('GET', `/api/needs?templeId=${TEMPLE}`)).json.reports.some(x => x.id === nq.id), false);
  const sub = (await V2('GET', '/api/my-submissions')).json.items.find(x => x.id === nq.id);
  assert.equal(sub.approval, 'rejected'); assert.equal(sub.reject_reason, 'Please add a photo link');

  // admin edits are never queued, even with approval on
  assert.equal((await ADMIN('POST', '/api/fields', { ...field, value: '+91 99999 00000' })).json.pending, false);

  // approve-all clears what is left; then the audit log shows submit / approve / reject
  assert.equal((await ADMIN('POST', '/api/admin/pending/approve-all', {})).json.approved, 1);
  assert.equal((await ANON('GET', `/api/notes/${TEMPLE}`)).json.notes.length, notesBefore + 1, 'approved note is now public');
  const actions = (await ADMIN('GET', '/api/admin/edits')).json.edits.map(e => e.action);
  for (const a of ['submit', 'approve', 'reject']) assert.ok(actions.includes(a), a);

  // switch back to bypass: live at once again; the switch change is in the log and can be reverted
  assert.equal((await ADMIN('POST', '/api/admin/settings', { requireApproval: false })).status, 200);
  r = await V2('POST', '/api/fields', { ...field, value: '+91 22222 33333' });
  assert.equal(r.json.pending, false);
  assert.equal((await ANON('GET', `/api/fields/${TEMPLE}`)).json.values.find(x => x.key === 'phone').value, '+91 22222 33333');
});

test('email verification is off: no link routes, and an email never grants admin', async () => {
  assert.equal((await ANON('POST', '/api/auth/request-link', { email: 'x@example.com', displayName: 'X Y' })).status, 404, 'verification routes are disabled');
  assert.equal((await ANON('GET', '/api/auth/verify?token=abc')).status, 404);
  // the dummy admin exists (created earlier); typing its email must not give anyone admin
  const stranger = browser();
  const r = await stranger('POST', '/api/auth/sign-in', { email: 'admin@demo.local', displayName: 'Not the admin' });
  assert.equal(r.status, 403);
  assert.equal((await stranger('GET', '/api/me')).json.user, null);
  // a new email becomes a volunteer, never an admin
  const v = browser();
  assert.equal((await v('POST', '/api/auth/sign-in', { email: `new-${stamp}@example.com`, displayName: 'New Person' })).status, 200);
  assert.equal((await v('GET', '/api/me')).json.user.role, 'volunteer');
  assert.equal((await v('GET', '/api/admin/pending')).status, 403);
});
