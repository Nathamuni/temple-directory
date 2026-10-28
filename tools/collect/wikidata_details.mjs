// Fills empty detail fields (deity, website, image, phone, address) on temple records from their matched Wikidata item.
// Usage: node tools/collect/wikidata_details.mjs [--dry]
// Source: Wikidata, CC0. Only empty fields are filled, and each filled record gets details_source = the Wikidata QID.
// Never overwrites a value already in the record, and never invents one.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = join(root, 'india-temples.json');
const DRY = process.argv.includes('--dry');
const WD = 'https://www.wikidata.org/w/api.php';
const UA = { 'User-Agent': 'TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)' };
const PROPS = { deity: 'P825', website: 'P856', image: 'P18', phone: 'P1329', address: 'P6375' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikidata throttles bursts; retry with backoff rather than failing the run.
async function api(params) {
  const url = `${WD}?${new URLSearchParams({ format: 'json', ...params })}`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url, { headers: UA });
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      if (!j.error) return j;
    } catch {}
    await sleep(attempt * 5000);
  }
  throw new Error(`Wikidata request failed: ${params.action}`);
}

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const first = (ent, prop) => ent.claims?.[prop]?.find((c) => c.mainsnak?.datavalue)?.mainsnak.datavalue.value;

const data = JSON.parse(await readFile(file, 'utf8'));
const byQid = new Map();
for (const t of data.elements) {
  const qid = t.enrich?.wikidata?.qid || t.tags?.wikidata;
  if (!qid) continue;
  if (!byQid.has(qid)) byQid.set(qid, []);
  byQid.get(qid).push(t);
}
const qids = [...byQid.keys()];
console.log(`${qids.length} distinct Wikidata items across ${[...byQid.values()].flat().length} records`);

// 1. Claims for every item.
const claims = new Map();
for (const batch of chunks(qids, 50)) {
  const j = await api({ action: 'wbgetentities', ids: batch.join('|'), props: 'claims' });
  for (const [id, ent] of Object.entries(j.entities || {})) claims.set(id, ent);
  await sleep(300);
}

// 2. English labels for the deity items referenced.
const deityIds = [...new Set([...claims.values()].map((e) => first(e, PROPS.deity)?.id).filter(Boolean))];
const deityLabel = new Map();
for (const batch of chunks(deityIds, 50)) {
  const j = await api({ action: 'wbgetentities', ids: batch.join('|'), props: 'labels', languages: 'en' });
  for (const [id, ent] of Object.entries(j.entities || {})) if (ent.labels?.en) deityLabel.set(id, ent.labels.en.value);
  await sleep(300);
}

// 3. Fill only empty fields.
const filled = { deity: 0, website: 0, image: 0, phone: 0, 'addr:full': 0 };
let recordsTouched = 0;
for (const [qid, recs] of byQid) {
  const ent = claims.get(qid);
  if (!ent) continue;
  const d = first(ent, PROPS.deity);
  const deity = d?.id ? deityLabel.get(d.id) : null;
  const website = first(ent, PROPS.website)?.toString() || null;
  const image = first(ent, PROPS.image);
  const imageUrl = image ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(String(image).replace(/ /g, '_'))}` : null;
  const phone = first(ent, PROPS.phone)?.toString() || null;
  const address = first(ent, PROPS.address)?.text || null;
  for (const t of recs) {
    const tags = (t.tags ||= {});
    const got = [];
    if (deity && !tags.deity) { tags.deity = deity; filled.deity++; got.push('deity'); }
    if (website && !tags.website) { tags.website = website; filled.website++; got.push('website'); }
    if (imageUrl && !tags.image) { tags.image = imageUrl; filled.image++; got.push('image'); }
    if (phone && !tags.phone) { tags.phone = phone; filled.phone++; got.push('phone'); }
    if (address && !tags['addr:full']) { tags['addr:full'] = address; filled['addr:full']++; got.push('addr:full'); }
    if (got.length) {
      t.details_source = qid;
      recordsTouched++;
    }
  }
}

console.log(`records with new details: ${recordsTouched}`);
console.log('fields filled:', JSON.stringify(filled));
if (!DRY) {
  await writeFile(file, JSON.stringify(data, null, 0));
  console.log(`wrote ${data.elements.length} elements to india-temples.json`);
}
