/* Volunteer sign-in, the small "Volunteer · data accuracy" label, and the dummy admin page. Loaded after api.js. */
(() => {
const TIP = 'Volunteers keep this data accurate. Every change is logged and can be reverted.';
const fmt = s => { try { return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s || ''; } };

/* Label shown next to every volunteer-supplied value: "Volunteer · Asha · 12 Oct 2026" */
window.volunteerBadge = (name, when) => `<span class="vol-badge" title="${esc(TIP)}"><span class="vol-dot" aria-hidden="true"></span>Volunteer${name ? ' · ' + esc(name) : ''}${when ? ' · ' + esc(fmt(when)) : ''}</span>`;

/* Gate for add/edit forms: returns true when signed in, otherwise sends the visitor to sign in and back. */
window.requireVolunteer = () => {
  if (Api.user) return true;
  try { sessionStorage.setItem('td-return', location.hash); } catch {}
  toast('Sign in as a volunteer to add or edit data.');
  location.hash = '#volunteer';
  return false;
};
window.signInNotice = () => Api.user ? '' : '<p class="notice vol-gate">Anyone can rate, comment and upvote. To <strong>add or edit data</strong>, <a href="#volunteer" onclick="try{sessionStorage.setItem(\'td-return\',location.hash)}catch{}">sign in as a volunteer</a> (name and email, no password).</p>';

/* Header bar */
function renderWho() {
  const bar = document.querySelector('.demo .wrap'); if (!bar) return;
  const u = Api.user;
  bar.innerHTML = `<span>${Api.mode === 'server' ? 'Volunteer-maintained' : 'Demo mode · data stays in this browser'} · every change is logged and can be reverted</span>
  <span class="vol-who">${u ? `<span class="vol-badge vol-me" title="${esc(TIP)}"><span class="vol-dot" aria-hidden="true"></span>Volunteer · data accuracy</span><strong>${esc(u.name)}</strong>${u.role === 'admin' ? '<a href="#admin">Admin (demo)</a>' : ''}<button class="textbtn" id="vol-out">Sign out</button>` : '<a class="vol-link" href="#volunteer">Volunteer sign-in</a>'}</span>`;
  document.querySelector('#vol-out')?.addEventListener('click', async () => { await Api.logout(); toast('Signed out.'); });
}

/* Sign-in page */
function signInPage() {
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.remove('active'));
  const u = Api.user, si = Api.signInInfo;
  if (u) {
    app.innerHTML = `<div class="wrap page vol-page"><h1>You are signed in</h1><p class="lede">${window.volunteerBadge(u.name)}</p>
      <p>Thank you for helping keep temple data accurate. As a volunteer you can add profile values, report needs and add notes. Each needs a source and a date and is logged so it can be reverted. ${Api.approvalRequired&&!Api.isAdmin?'<strong>An admin reviews each change before it appears.</strong>':'Changes go live at once.'}</p>${u.role==='admin'?'<p><a class="btn secondary" href="#admin">Open the admin page</a></p>':''}<section id="vol-subs"><h2>My submissions</h2><p class="muted">Loading…</p></section>
      <div class="actions"><a class="btn" href="#discover">Find a temple</a><a class="btn secondary" href="#needs">Needs board</a><button class="btn secondary" id="vol-out2">Sign out</button></div></div>`;
    document.querySelector('#vol-out2').onclick = async () => { await Api.logout(); toast('Signed out.'); };
    Api.mySubmissions().then(items => {
      const el = document.querySelector('#vol-subs'); if (!el) return;
      const chipOf = x => x.approval === 'pending' ? '<span class="nd-chip nd-pending-approval">Pending approval</span>' : x.approval === 'rejected' ? '<span class="nd-chip nd-rejected">Rejected</span>' : '<span class="nd-chip nd-verified">Live</span>';
      el.innerHTML = `<h2>My submissions</h2>${items.length ? `<ul class="vol-subs">${items.map(x => `<li>${chipOf(x)} <strong>${esc(x.temple)}</strong> · ${esc(x.title)}<br><span class="help">${esc(String(x.detail).slice(0, 120))}${x.approval === 'rejected' && x.reject_reason ? ' · Reason: ' + esc(x.reject_reason) : ''}</span></li>`).join('')}</ul>` : '<p class="muted">You have not submitted anything yet.</p>'}`;
    }).catch(() => {});
    return;
  }
  app.innerHTML = `<div class="wrap page vol-page"><h1>Volunteer sign-in</h1>
    <p class="lede">Anyone can <strong>rate, comment and upvote</strong> without signing in. Adding or editing temple data needs a name and an email, so every change can be traced and reverted.</p>
    <form id="vol-form" class="panel vol-form" novalidate>
      <label>Display name<input name="displayName" required minlength="2" maxlength="40" autocomplete="name" placeholder="Shown next to your edits"></label>
      <label>Email<input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label>
      <button class="btn" type="submit">Sign in</button>
      <p class="help">No password. We store your name and email so your changes can be attributed. Email verification is switched off for now, so your email address is not checked.${Api.mode === 'server' ? '' : ' Demo mode: this stays in this browser.'}</p>
      <p id="vol-msg" role="status" class="help"></p>
    </form>
    ${si.dev ? '<p class="help"><button class="textbtn" id="vol-dev">Sign in as the dummy admin</button></p>' : ''}</div>`;
  document.querySelector('#vol-form').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target), msg = document.querySelector('#vol-msg'); msg.textContent = '';
    try {
      await Api.signIn(String(f.get('email')).trim(), String(f.get('displayName')).trim());
      afterSignIn();
      /* EMAIL VERIFICATION (disabled for now): this was
         const r = await Api.requestLink(email, name);
         if (r.devLink) msg.innerHTML = `Development mode: no email is sent. <a href="${esc(r.devLink)}">Open your sign-in link</a>.`;
         else msg.textContent = 'Check your email for the sign-in link (valid for 15 minutes).'; */
    } catch (err) { msg.textContent = err.message; }
  };
  document.querySelector('#vol-dev')?.addEventListener('click', async () => { try { await Api.devAdmin(); afterSignIn(); } catch (err) { toast(err.message); } });
}
function afterSignIn() {
  let back = '#volunteer'; try { back = sessionStorage.getItem('td-return') || '#discover'; sessionStorage.removeItem('td-return'); } catch {}
  toast('Signed in.'); location.hash = back === '#volunteer' ? '#discover' : back;
}

/* Admin: approval switch, pending queue, change log with revert. Simple on purpose. */
const KIND = { field: 'Profile value', need: 'Needs report', note: 'Note' };
const ENT = { field_value: 'Profile value', needs_report: 'Needs report', note: 'Note', comment: 'Comment', setting: 'Setting' };
const ACT = { create: 'added', update: 'changed', submit: 'submitted', approve: 'approved', reject: 'rejected', revert: 'reverted', hide: 'hidden', restore: 'restored' };
const baseAdmin = admin;
admin = async function () {
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.remove('active'));
  if (!Api.isAdmin) {
    app.innerHTML = `<div class="wrap page"><h1>Admin</h1><p class="lede">Admins approve volunteer changes (or switch approval off), review the change log and revert edits.</p><p><a class="btn" href="#volunteer">Sign in</a></p></div>`;
    return;
  }
  app.innerHTML = '<div class="wrap page"><h1>Admin</h1><p class="muted" role="status">Loading…</p></div>';
  try {
    const [settings, queue, edits] = await Promise.all([Api.settings(), Api.pending(), Api.adminEdits()]);
    const on = settings.requireApproval;
    const reverted = new Set(edits.filter(e => e.revert_of).map(e => e.revert_of));
    app.innerHTML = `<div class="wrap page adm"><h1>Admin</h1>
      <section class="panel adm-switch"><div><h2>Approval for volunteer changes</h2>
        <p class="adm-state" role="status">${on ? '<strong>Approval is ON.</strong> New volunteer changes wait here until you approve or reject them.' : '<strong>Approval is OFF (bypass).</strong> Volunteer changes go live at once. They are still logged and can be reverted.'}</p>
        <p class="help">Ratings, comments and upvotes never need approval. Your own edits as an admin are always published directly.</p></div>
        <label class="adm-toggle"><input type="checkbox" id="adm-req" ${on ? 'checked' : ''}> Require approval</label></section>
      <section><div class="adm-head"><h2>Waiting for approval <span class="muted">(${queue.length})</span></h2>${queue.length ? '<button class="btn small" id="adm-all">Approve all</button>' : ''}</div>
      ${queue.length ? `<table class="nd-table"><thead><tr><th scope="col">What</th><th scope="col">Temple</th><th scope="col">Submitted</th><th scope="col">Detail</th><th scope="col">Source</th><th scope="col">By</th><th scope="col"></th></tr></thead><tbody>${queue.map(q => `<tr><td data-label="What">${esc(KIND[q.kind] || q.kind)}<br><span class="help">${esc(q.title)}</span></td><td data-label="Temple"><a href="#temple/${encodeURIComponent(q.temple_id)}">${esc(q.temple)}</a></td><td data-label="Submitted">${esc(fmt(q.created_at))}</td><td data-label="Detail">${esc(String(q.detail).slice(0, 140))}</td><td data-label="Source">${esc(String(q.source_ref || '').slice(0, 80))}</td><td data-label="By">${esc(q.display_name || '')}</td><td><button class="btn small" data-ok="${esc(q.kind)}|${esc(q.id)}">Approve</button> <button class="textbtn" data-no="${esc(q.kind)}|${esc(q.id)}">Reject</button></td></tr>`).join('')}</tbody></table>` : `<div class="panel"><p class="muted">Nothing is waiting. ${on ? 'New volunteer changes will appear here.' : 'With approval off, volunteer changes go live at once.'}</p></div>`}</section>
      <section><h2>Change log</h2><p class="muted">Every change that went live is listed here. <strong>Revert</strong> undoes one.</p>
      ${edits.length ? `<table class="nd-table"><thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Action</th><th scope="col">Detail</th><th scope="col"></th></tr></thead><tbody>${edits.map(e => {
        const a = e.after || {}, detail = e.entity === 'setting' ? (a.requireApproval ? 'Approval turned on' : 'Approval turned off (bypass)') : (a.value || a.title || a.text || a.status || '');
        const can = !['revert', 'submit', 'reject'].includes(e.action) && !reverted.has(e.id);
        return `<tr><td data-label="When">${esc(fmt(e.at))}</td><td data-label="Who">${esc(e.actor_name || '')}</td><td data-label="What">${esc(ENT[e.entity] || e.entity)}</td><td data-label="Action">${esc(ACT[e.action] || e.action)}</td><td data-label="Detail">${esc(String(detail).slice(0, 90))}</td><td>${can ? `<button class="textbtn" data-revert="${esc(e.id)}">Revert</button>` : reverted.has(e.id) ? '<span class="help">reverted</span>' : ''}</td></tr>`;
      }).join('')}</tbody></table>` : '<div class="panel"><p class="muted">No changes yet.</p></div>'}</section></div>`;
    const redo = async (fn, msg) => { try { await fn(); toast(msg); admin(); } catch (err) { toast(err.message); } };
    document.querySelector('#adm-req').onchange = e => redo(() => Api.setSettings(e.target.checked), e.target.checked ? 'Approval is now required.' : 'Approval bypass is on: changes go live at once.').then(() => Api.refreshMe());
    document.querySelector('#adm-all')?.addEventListener('click', () => redo(async () => { const r = await Api.approveAll(); toast(`${r.approved} approved.`); }, 'Done.'));
    app.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.ok.split('|'); redo(() => Api.decide(k, id, 'approve'), 'Approved and published.'); });
    app.querySelectorAll('[data-no]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.no.split('|'); const reason = prompt('Why is it rejected? (shown to the volunteer)'); if (reason === null) return; redo(() => Api.decide(k, id, 'reject', reason), 'Rejected.'); });
    app.querySelectorAll('[data-revert]').forEach(b => b.onclick = () => redo(() => Api.revert(Number.isNaN(+b.dataset.revert) ? b.dataset.revert : +b.dataset.revert), 'Reverted.'));
  } catch (err) { app.innerHTML = `<div class="wrap page"><h1>Admin</h1><p class="notice">${esc(err.message)}</p></div>`; }
};

const baseRender = render;
render = function () { if ((location.hash.slice(1) || '') === 'volunteer') { signInPage(); window.scrollTo(0, 0); } else baseRender(); };
document.addEventListener('api:session', () => { renderWho(); if (location.hash === '#volunteer') signInPage(); });
Api.ready.then(() => { renderWho(); if (location.hash === '#volunteer') signInPage(); });
renderWho();
})();
