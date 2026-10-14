// Open exports: the data is never locked in. NDJSON / CSV / GeoJSON of all temples and a JSON of community data.
// No export contains an email address.
import { q } from '../db.js';

const BATCH = 2000;
async function* temples(cols) {
  let last = '';
  for (;;) {
    const r = await q(`SELECT ${cols} FROM temples WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, [last]);
    if (!r.rowCount) return;
    yield* r.rows;
    last = r.rows[r.rowCount - 1].id;
  }
}
const csvCell = v => { if (v == null) return ''; const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export default async function routes(app) {
  const head = (reply, type, file) => reply.header('Content-Type', type + '; charset=utf-8').header('Content-Disposition', `attachment; filename="${file}"`).header('Cache-Control', 'no-cache');

  app.get('/api/export/temples.ndjson', async (req, reply) => {
    head(reply, 'application/x-ndjson', 'temples.ndjson');
    reply.raw.writeHead(200, reply.getHeaders());
    for await (const t of temples('id, country, state, district, name, native_name, lat, lon, deity, deity_basis, tradition, completeness, photo, tags, enrich, computed')) reply.raw.write(JSON.stringify(t) + '\n');
    reply.raw.end(); return reply;
  });

  app.get('/api/export/temples.csv', async (req, reply) => {
    head(reply, 'text/csv', 'temples.csv');
    reply.raw.writeHead(200, reply.getHeaders());
    const cols = ['id', 'country', 'state', 'district', 'name', 'native_name', 'lat', 'lon', 'deity', 'deity_basis', 'tradition', 'pincode', 'website', 'phone', 'opening_hours', 'nearest_rail', 'nearest_bus', 'nearest_airport', 'photo_url', 'photo_credit', 'photo_license'];
    reply.raw.write(cols.join(',') + '\n');
    for await (const t of temples('id, country, state, district, name, native_name, lat, lon, deity, deity_basis, tradition, photo, tags, computed')) {
      const g = t.tags || {}, c = t.computed || {}, nm = x => x ? `${x.name} (${(x.dist_m / 1000).toFixed(1)} km)` : '';
      reply.raw.write([t.id, t.country, t.state, t.district, t.name, t.native_name, t.lat, t.lon, t.deity, t.deity_basis, t.tradition, g['addr:postcode'], g.website || g['contact:website'], g.phone || g['contact:phone'], g.opening_hours,
        nm(c.nearest_rail), nm(c.nearest_bus), nm(c.nearest_airport), t.photo?.original_url || t.photo?.url, t.photo?.credit, t.photo?.license].map(csvCell).join(',') + '\n');
    }
    reply.raw.end(); return reply;
  });

  app.get('/api/export/temples.geojson', async (req, reply) => {
    head(reply, 'application/geo+json', 'temples.geojson');
    reply.raw.writeHead(200, reply.getHeaders());
    reply.raw.write('{"type":"FeatureCollection","features":[\n');
    let first = true;
    for await (const t of temples('id, country, state, district, name, lat, lon, deity, deity_basis, tradition')) {
      reply.raw.write((first ? '' : ',\n') + JSON.stringify({ type: 'Feature', id: t.id, geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
        properties: { name: t.name, country: t.country, state: t.state, district: t.district, deity: t.deity, deity_basis: t.deity_basis, tradition: t.tradition } }));
      first = false;
    }
    reply.raw.end('\n]}'); return reply;
  });

  app.get('/api/export/community.json', async (req, reply) => {
    head(reply, 'application/json', 'community.json');
    const [ratings, comments, needs, notes, fields, edits] = await Promise.all([
      q('SELECT temple_id, item_key, stars, display_name, updated_at FROM ratings ORDER BY temple_id, item_key'),
      q('SELECT c.id, c.temple_id, c.item_key, c.text, c.display_name, c.created_at, (SELECT count(*)::int FROM upvotes v WHERE v.comment_id = c.id) AS upvotes FROM comments c WHERE NOT c.hidden ORDER BY c.created_at'),
      q("SELECT id, temple_id, category, area, severity, title, description, observed_on, evidence, status, display_name, created_at FROM needs_reports WHERE approval = 'approved' ORDER BY created_at"),
      q("SELECT id, temple_id, type, text, basis, display_name, created_at FROM notes WHERE NOT hidden AND approval = 'approved' ORDER BY created_at"),
      q("SELECT temple_id, field_key, value, source_type, source_ref, checked_on, display_name, current, created_at FROM field_values WHERE approval = 'approved' ORDER BY id"),
      q('SELECT id, at, actor_name, entity, entity_id, action, revert_of FROM edits ORDER BY id'),
    ]);
    return { exported_at: new Date().toISOString(), note: 'No email addresses are included.', ratings: ratings.rows, comments: comments.rows, needs_reports: needs.rows, notes: notes.rows, field_values: fields.rows, edits: edits.rows };
  });
}
