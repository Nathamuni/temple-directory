import { q } from '../db.js';

const PUBLIC = 'id, country, state, district, name, native_name, lat, lon, deity, deity_basis, tradition, completeness, photo, tags, enrich, computed';

export default async function routes(app) {
  app.get('/api/health', async () => {
    const r = await q('SELECT count(*)::int AS temples FROM temples');
    return { ok: true, db: true, temples: r.rows[0].temples };
  });
  app.get('/api/config', async () => ({ countries: (await q('SELECT country, count(*)::int AS n FROM temples GROUP BY 1 ORDER BY 2 DESC')).rows }));

  app.get('/api/temples/:id', async (req, reply) => {
    const r = await q(`SELECT ${PUBLIC} FROM temples WHERE id = $1`, [req.params.id]);
    if (!r.rowCount) return reply.code(404).send({ error: 'Unknown temple.' });
    return r.rows[0];
  });

  // Simple list for API consumers: ?state=&district=&q=&limit=&offset=
  app.get('/api/temples', async req => {
    const { state, district, country, q: text } = req.query;
    const limit = Math.min(Number(req.query.limit) || 50, 200), offset = Math.max(Number(req.query.offset) || 0, 0);
    const p = [], w = [];
    for (const [col, v] of [['state', state], ['district', district], ['country', country]]) if (v) { p.push(v); w.push(`${col} = $${p.length}`); }
    if (text) { p.push('%' + String(text).replace(/[%_\\]/g, '\\$&') + '%'); w.push(`name ILIKE $${p.length}`); }
    p.push(limit, offset);
    const r = await q(`SELECT id, country, state, district, name, deity, lat, lon FROM temples ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
    return { temples: r.rows, limit, offset };
  });
}
