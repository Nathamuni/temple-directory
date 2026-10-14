#!/usr/bin/env node
// Downloads every Hindu temple OpenStreetMap lists in India and writes india-temples.json
// (Overpass format, each element tagged with its state) for the "Load bundled India dataset" button.
// Usage: node tools/fetch-india-temples.mjs        (resumable: re-run after any interruption)
//        node tools/fetch-india-temples.mjs "Kerala" "Goa"   (only these states)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'india-temples.json');
const stateFile = join(root, 'tools', '.fetch-state.json');
const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)';
const MIN_TILE = 0.25; // degrees; stop splitting below this
const sleep = ms => new Promise(r => setTimeout(r, ms));
let epIndex = 0;

async function overpass(query, attempts = 6) {
  let last;
  for (let i = 0; i < attempts; i++) {
    const ep = endpoints[epIndex % endpoints.length];
    try {
      const r = await fetch(ep, {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(200000),
      });
      if (r.status === 429 || r.status === 504 || r.status === 503) throw Error('HTTP ' + r.status);
      if (!r.ok) throw Error('HTTP ' + r.status);
      const text = await r.text();
      let d;
      try { d = JSON.parse(text); } catch { throw Error('non-JSON reply (server busy)'); }
      if (d.remark && /error|timed out|out of memory/i.test(d.remark)) throw Error(d.remark);
      if (!Array.isArray(d.elements)) throw Error('no elements array');
      return d;
    } catch (e) {
      last = e;
      console.error(`  ${ep} attempt ${i + 1}/${attempts}: ${e.message}`);
      epIndex++; // rotate mirror
      await sleep(Math.min(30000, 2000 * 2 ** i));
    }
  }
  throw last;
}

const TAGS = '["religion"="hindu"]';
const select = (area, bbox) =>
  `nwr["amenity"="place_of_worship"]${TAGS}(area.${area})(${bbox});nwr["building"="temple"]${TAGS}(area.${area})(${bbox});`;

async function getStates() {
  const d = await overpass('[out:json][timeout:90];area["ISO3166-1"="IN"][admin_level=2]->.i;rel["boundary"="administrative"]["admin_level"="4"](area.i);out tags bb;');
  return d.elements
    .filter(x => x.tags?.['ISO3166-2']?.startsWith('IN-') && x.bounds)
    .map(x => ({ id: x.id, name: x.tags['name:en'] || x.tags.name, b: x.bounds }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Fetch one tile; on failure, split into four and recurse so big cities never time out.
async function fetchTile(state, s, w, n, e, out) {
  const bbox = [s, w, n, e].map(v => v.toFixed(4)).join(',');
  const q = `[out:json][timeout:180];rel(${state.id});map_to_area->.st;(${select('st', bbox)});out center tags;`;
  try {
    const d = await overpass(q, 3);
    for (const el of d.elements) out.set(el.type + '/' + el.id, { ...el, state: state.name });
  } catch (err) {
    if (n - s <= MIN_TILE && e - w <= MIN_TILE) throw Error(`tile ${bbox} failed: ${err.message}`);
    const ms = (s + n) / 2, mw = (w + e) / 2;
    for (const [a, b, c, d2] of [[s, w, ms, mw], [s, mw, ms, e], [ms, w, n, mw], [ms, mw, n, e]])
      await fetchTile(state, a, b, c, d2, out);
  }
  await sleep(1200); // be polite to the shared servers
}

// One file per state in data/states/, plus data/states/index.json with counts.
async function writeStateFiles(elements) {
  const dir = join(root, 'data', 'states');
  await mkdir(dir, { recursive: true });
  const by = {};
  for (const el of elements) (by[el.state] ||= []).push(el);
  const index = [];
  for (const [name, els] of Object.entries(by).sort()) {
    const file = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';
    await writeFile(join(dir, file), JSON.stringify({ state: name, count: els.length, copyright: '© OpenStreetMap contributors, ODbL 1.0', elements: els }, null, 1));
    index.push({ state: name, file, count: els.length });
  }
  await writeFile(join(dir, 'index.json'), JSON.stringify({ total: elements.length, states: index }, null, 1));
}

async function main() {
  await mkdir(join(root, 'tools'), { recursive: true });
  const saved = existsSync(stateFile) ? JSON.parse(await readFile(stateFile, 'utf8')) : { done: {}, elements: {} };
  const only = process.argv.slice(2);
  console.log('Finding state boundaries…');
  const states = (await getStates()).filter(s => !only.length || only.includes(s.name));
  if (!states.length) throw Error('No matching states returned');
  const failed = [];

  for (const [i, st] of states.entries()) {
    if (saved.done[st.name]) { console.log(`[${i + 1}/${states.length}] ${st.name}: already done (${saved.done[st.name]})`); continue; }
    const out = new Map();
    const { minlat, minlon, maxlat, maxlon } = st.b;
    const step = 100; // one query per state; fetchTile subdivides only on failure
    try {
      for (let s = minlat; s < maxlat; s += step)
        for (let w = minlon; w < maxlon; w += step)
          await fetchTile(st, s, w, Math.min(s + step, maxlat), Math.min(w + step, maxlon), out);
      for (const [k, v] of out) saved.elements[k] = v;
      saved.done[st.name] = out.size;
      await writeFile(stateFile, JSON.stringify(saved));
      console.log(`[${i + 1}/${states.length}] ${st.name}: ${out.size} records`);
    } catch (e) {
      failed.push(st.name);
      console.error(`[${i + 1}/${states.length}] ${st.name} FAILED: ${e.message} (re-run to retry)`);
    }
  }

  const elements = Object.values(saved.elements);
  await writeStateFiles(elements);
  await writeFile(outFile, JSON.stringify({ version: 0.6, generator: 'fetch-india-temples.mjs', osm3s: { copyright: '© OpenStreetMap contributors, ODbL 1.0' }, elements }));
  console.log(`\nWrote ${elements.length} records from ${Object.keys(saved.done).length} states to ${outFile}`);
  if (failed.length) { console.error('Incomplete states: ' + failed.join(', ')); process.exitCode = 2; }
}

main().catch(e => { console.error(e); process.exit(1); });
