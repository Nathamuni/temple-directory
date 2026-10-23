// Loads data/india-temples.json (Overpass-style elements with enrichment) into the `temples` table.
// Idempotent: re-running updates rows by OSM id. Usage: npm run import [path]
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = process.argv[2] || join(root, 'india-temples.json');
const { elements } = JSON.parse(await readFile(file, 'utf8'));

const row = e => {
  const t = e.tags || {}, en = e.enrich || {};
  const name = t['name:en'] || t.name || en.name_en?.value || 'Unnamed Hindu temple';
  const d = en.deity;
  const deity = d ? d.values.join(', ') : (t.deity || t.dedication || null);
  const pos = e.lat !== undefined ? [e.lat, e.lon] : e.center ? [e.center.lat, e.center.lon] : [null, null]; // name-only records have no position
  return {
    id: e.type === 'wikidata' ? `wd-Q${e.id}` : e.type === 'hrce' ? `hrce-${t['ref:hrce'] || e.id}` : `osm-${e.type}-${e.id}`, osm_type: e.type, osm_id: e.id, country: 'India', state: e.state, district: e.district || null,
    name, native_name: t.name || null, named: !!(t.name || t['name:en'] || en.name_en),
    lat: pos[0], lon: pos[1], deity, deity_basis: d?.basis || null, tradition: t.denomination || null,
    tags: t, enrich: en, computed: e.computed || {}, completeness: e.completeness?.score ?? null, photo: en.nearby_photo || null, located: e.located !== false,
  };
};

const SQL = `
INSERT INTO temples (id, osm_type, osm_id, country, state, district, name, native_name, named, lat, lon, deity, deity_basis, tradition, tags, enrich, computed, completeness, photo, located, updated_at)
SELECT x.id, x.osm_type, x.osm_id, x.country, x.state, x.district, x.name, x.native_name, x.named, x.lat, x.lon, x.deity, x.deity_basis, x.tradition, x.tags, x.enrich, x.computed, x.completeness, x.photo, x.located, now()
FROM jsonb_to_recordset($1::jsonb) AS x(id text, osm_type text, osm_id bigint, country text, state text, district text, name text, native_name text, named boolean, lat double precision, lon double precision, deity text, deity_basis text, tradition text, tags jsonb, enrich jsonb, computed jsonb, completeness smallint, photo jsonb, located boolean)
ON CONFLICT (id) DO UPDATE SET country = EXCLUDED.country, state = EXCLUDED.state, district = EXCLUDED.district, name = EXCLUDED.name, native_name = EXCLUDED.native_name,
  named = EXCLUDED.named, lat = EXCLUDED.lat, lon = EXCLUDED.lon, deity = EXCLUDED.deity, deity_basis = EXCLUDED.deity_basis, tradition = EXCLUDED.tradition,
  tags = EXCLUDED.tags, enrich = EXCLUDED.enrich, computed = EXCLUDED.computed, completeness = EXCLUDED.completeness, photo = EXCLUDED.photo, located = EXCLUDED.located, updated_at = now()`;

const t0 = Date.now();
for (let i = 0; i < elements.length; i += 1000) {
  await pool.query(SQL, [JSON.stringify(elements.slice(i, i + 1000).map(row))]);
  if ((i / 1000) % 10 === 0) console.log(`  ${Math.min(i + 1000, elements.length)} / ${elements.length}`);
}
const { rows } = await pool.query('SELECT count(*)::int AS n FROM temples');
console.log(`imported ${elements.length} elements in ${((Date.now() - t0) / 1000).toFixed(1)}s; temples table now has ${rows[0].n} rows`);
await pool.end();
