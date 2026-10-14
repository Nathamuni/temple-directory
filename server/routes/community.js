// Open actions: anyone can rate, comment and upvote without signing in. A device cookie keeps it to one rating per
// item and one upvote per comment per browser. Without sign-in this cannot be airtight; limits reduce abuse.
import { q } from '../db.js';
import { device, user, limited, clean, isEmail } from '../auth.js';
import { ITEM_KEYS } from '../checklist.js';

const templeExists = async id => (await q('SELECT 1 FROM temples WHERE id = $1', [id])).rowCount > 0;
const bad = (reply, msg, code = 400) => reply.code(code).send({ error: msg });

async function rememberContact(req, dev, email, consent) {
  email = clean(email, 254).toLowerCase();
  if (email && consent === true && isEmail(email))
    await q('INSERT INTO contacts(email, device_id) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING', [email, dev]);
}

let summaryCache = { at: 0, data: null };

export default async function routes(app) {
  // Community view for one temple: per checklist item, average, count, my rating, visible comments.
  app.get('/api/community/:templeId', async (req, reply) => {
    const dev = await device(req, reply), u = await user(req), admin = u?.role === 'admin';
    const id = req.params.templeId;
    const [ratings, comments] = await Promise.all([
      q(`SELECT item_key, count(*)::int AS n, round(avg(stars)::numeric, 2)::float AS avg,
                max(stars) FILTER (WHERE device_id = $2) AS mine FROM ratings WHERE temple_id = $1 GROUP BY item_key`, [id, dev]),
      q(`SELECT c.id, c.item_key, c.text, c.display_name, c.created_at, c.hidden, (c.device_id = $2) AS mine,
                count(v.device_id)::int AS upvotes, coalesce(bool_or(v.device_id = $2), false) AS upvoted
         FROM comments c LEFT JOIN upvotes v ON v.comment_id = c.id
         WHERE c.temple_id = $1 AND ($3 OR NOT c.hidden)
         GROUP BY c.id ORDER BY upvotes DESC, c.created_at DESC LIMIT 500`, [id, dev, admin]),
    ]);
    const items = {};
    for (const r of ratings.rows) items[r.item_key] = { avg: r.avg, count: r.n, mine: r.mine, comments: [] };
    for (const c of comments.rows) (items[c.item_key] ||= { avg: null, count: 0, mine: null, comments: [] }).comments.push({
      id: c.id, text: c.text, name: c.display_name || 'Visitor', at: c.created_at, upvotes: c.upvotes, upvoted: c.upvoted, mine: c.mine, hidden: c.hidden });
    return { items };
  });

  app.post('/api/ratings', async (req, reply) => {
    const b = req.body || {};
    if (b.website) return { ok: true };                     // honeypot: bots fill hidden fields
    const dev = await device(req, reply);
    const stars = Number(b.stars), key = String(b.itemKey || ''), id = String(b.templeId || '');
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return bad(reply, 'Stars must be a whole number from 1 to 5.');
    if (!ITEM_KEYS.has(key)) return bad(reply, 'Unknown checklist item.');
    if (limited('rate:' + dev, 60, 3600e3) || limited('rate-ip:' + req.ip, 200, 3600e3)) return bad(reply, 'Too many ratings. Try again later.', 429);
    if (!(await templeExists(id))) return bad(reply, 'Unknown temple.', 404);
    const u = await user(req), name = clean(b.displayName, 40) || null;
    await q(`INSERT INTO ratings(temple_id, item_key, device_id, stars, display_name, user_id) VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (temple_id, item_key, device_id) DO UPDATE SET stars = EXCLUDED.stars, display_name = EXCLUDED.display_name, updated_at = now()`,
      [id, key, dev, stars, name, u?.id || null]);
    await rememberContact(req, dev, b.email, b.consent);
    summaryCache.at = 0;
    const r = await q('SELECT count(*)::int AS n, round(avg(stars)::numeric, 2)::float AS avg FROM ratings WHERE temple_id = $1 AND item_key = $2', [id, key]);
    return { ok: true, avg: r.rows[0].avg, count: r.rows[0].n, mine: stars };
  });

  app.post('/api/comments', async (req, reply) => {
    const b = req.body || {};
    if (b.website) return { ok: true };
    const dev = await device(req, reply);
    const id = String(b.templeId || ''), key = String(b.itemKey || '');
    const text = clean(b.text, 600).replace(/\s*\n\s*/g, ' ');
    if (!ITEM_KEYS.has(key)) return bad(reply, 'Unknown checklist item.');
    if (text.length < 5 || text.length > 500) return bad(reply, 'A comment must be 5 to 500 characters.');
    if (limited('cm-fast:' + dev, 1, 20e3)) return bad(reply, 'Please wait a few seconds before posting another comment.', 429);
    if (limited('cm-hour:' + dev, 10, 3600e3) || limited('cm-ip:' + req.ip, 40, 3600e3)) return bad(reply, 'Comment limit reached for now. Try again later.', 429);
    if (!(await templeExists(id))) return bad(reply, 'Unknown temple.', 404);
    const same = await q('SELECT count(*) FILTER (WHERE lower(text) = lower($3))::int AS dup, count(*)::int AS n FROM comments WHERE temple_id = $1 AND device_id = $2', [id, dev, text]);
    if (same.rows[0].dup) return bad(reply, 'You already posted this comment.', 409);
    if (same.rows[0].n >= 5) return bad(reply, 'You can post at most 5 comments per temple.', 429);
    const u = await user(req), name = clean(b.displayName, 40) || null;
    const r = await q('INSERT INTO comments(temple_id, item_key, text, device_id, user_id, display_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at', [id, key, text, dev, u?.id || null, name]);
    await rememberContact(req, dev, b.email, b.consent);
    summaryCache.at = 0;
    return { ok: true, comment: { id: r.rows[0].id, text, name: name || 'Visitor', at: r.rows[0].created_at, upvotes: 0, upvoted: false, mine: true } };
  });

  // Upvote only: toggles this browser's single upvote on a comment. There is no downvote.
  app.post('/api/upvotes', async (req, reply) => {
    const dev = await device(req, reply), cid = String(req.body?.commentId || '');
    if (!/^[0-9a-f-]{36}$/i.test(cid)) return bad(reply, 'Unknown comment.');
    if (limited('up:' + dev, 120, 3600e3)) return bad(reply, 'Too many votes. Try again later.', 429);
    const c = await q('SELECT device_id FROM comments WHERE id = $1 AND NOT hidden', [cid]);
    if (!c.rowCount) return bad(reply, 'Unknown comment.', 404);
    if (c.rows[0].device_id === dev) return bad(reply, 'You cannot upvote your own comment.', 403);
    const del = await q('DELETE FROM upvotes WHERE comment_id = $1 AND device_id = $2', [cid, dev]);
    if (!del.rowCount) await q('INSERT INTO upvotes(comment_id, device_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [cid, dev]);
    const n = await q('SELECT count(*)::int AS n FROM upvotes WHERE comment_id = $1', [cid]);
    summaryCache.at = 0;
    return { ok: true, upvoted: !del.rowCount, upvotes: n.rows[0].n };
  });

  // Home page aggregates. Only temples that actually have ratings are touched; cached for 30 s.
  app.get('/api/community-summary', async () => {
    if (summaryCache.data && Date.now() - summaryCache.at < 30e3) return summaryCache.data;
    const MIN = 3;
    const [top, upv, items, totals] = await Promise.all([
      q(`SELECT t.id, t.name, t.state, t.district, round(avg(r.stars)::numeric, 2)::float AS avg, count(*)::int AS n
         FROM ratings r JOIN temples t ON t.id = r.temple_id GROUP BY t.id HAVING count(*) >= $1 ORDER BY avg DESC, n DESC LIMIT 12`, [MIN]),
      q(`SELECT c.id, c.text, c.item_key, t.id AS temple_id, t.name, t.state, count(v.device_id)::int AS upvotes
         FROM comments c JOIN temples t ON t.id = c.temple_id JOIN upvotes v ON v.comment_id = c.id WHERE NOT c.hidden
         GROUP BY c.id, t.id ORDER BY upvotes DESC, c.created_at DESC LIMIT 12`),
      q('SELECT item_key, count(*)::int AS n, round(avg(stars)::numeric, 2)::float AS avg FROM ratings GROUP BY item_key'),
      q(`SELECT (SELECT count(*) FROM ratings)::int AS ratings, (SELECT count(*) FROM comments WHERE NOT hidden)::int AS comments,
                (SELECT count(DISTINCT temple_id) FROM ratings)::int AS temples`),
    ]);
    summaryCache = { at: Date.now(), data: { minRatings: MIN, topRated: top.rows, mostUpvoted: upv.rows, items: items.rows, totals: totals.rows[0] } };
    return summaryCache.data;
  });
}
