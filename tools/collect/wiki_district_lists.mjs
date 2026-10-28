// Adds temples named on Wikipedia district lists to india-temples.json as name-only records (located: false).
// Usage: node tools/collect/wiki_district_lists.mjs [--dry]
// Source: English Wikipedia, CC BY-SA 4.0. No coordinates are invented. Records are skipped when the state already holds
// a temple with the same normalised name.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = join(root, 'india-temples.json');
const DRY = process.argv.includes('--dry');
const BATCH = '2026-10-27-wiki-districts';

const PAGES = [
  { title: 'List of Hindu temples in Rayagada district', state: 'Odisha', district: 'Rayagada' },
  { title: 'List of Hindu temples in Bhubaneswar', state: 'Odisha', district: 'Khordha' },
  { title: 'List of Hindu temples in Tulu Nadu', state: 'Karnataka', district: null },
  { title: 'List of Hindu temples in Pune', state: 'Maharashtra', district: 'Pune' },
];

const GENERIC = /\b(sri|shri|sree|swamy|swami|temple|temples|mandir|mandira|devasthanam|devalaya|kshetra|the|of|and|hindu|shrine)\b/gi;
const norm = (s) => s.toLowerCase().replace(GENERIC, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

// Strip wiki markup and keep the visible text of the first link, or the plain text before a separator.
function visibleName(cell) {
  let s = cell.replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>|\{\{[\s\S]*?\}\}|<[^>]+>/g, '');
  const link = s.match(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/);
  s = link ? link[1] : s.replace(/\[\[|\]\]/g, '');
  s = s.replace(/'{2,}/g, '').split(/\s[–—-]\s|\s\(|,\s/)[0].trim();
  return isName(s) ? s : null;
}

// Rejects table attributes, dates, descriptions and bare deity or material words from table cells.
function isName(s) {
  const words = s.trim().split(/\s+/);
  if (s.length < 3 || s.length > 80 || words.length > 7) return false;
  if (!/^[A-Z]/.test(s) || /[=/]|\d/.test(s) || /^lists? of/i.test(s)) return false;
  if (/\b(is|was|are|were|built|century|porch|structure|according|local)\b|\. /i.test(s)) return false;
  if (words.length === 1 && !/(temple|mandir|kali|devi|shiva|vishnu|hanuman|durga|ganapati|parameswari|ambika|shakti)/i.test(s)) return false;
  return true;
}

function entriesFrom(wikitext) {
  const out = [];
  for (const line of wikitext.split('\n')) {
    if (/^\s*[*#]\s*/.test(line)) out.push(line.replace(/^\s*[*#]+\s*/, ''));
    else if (/^\|/.test(line) && !/^\|-|^\{\||^\|\}|^\|\s*(class|style|width)=/.test(line)) out.push(line.replace(/^\|\s*/, '').split('||')[0]);
  }
  return out.map(visibleName).filter(Boolean);
}

// Wikipedia answers "too many requests" under load; wait and retry instead of failing the run.
async function fetchWikitext(url) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'temple-directory-collector/1.0' } });
    const text = await res.text();
    try {
      return JSON.parse(text).parse.wikitext;
    } catch {
      console.log(`attempt ${attempt} throttled; waiting ${attempt * 20}s`);
      await new Promise((r) => setTimeout(r, attempt * 20000));
    }
  }
  throw new Error(`gave up after retries: ${url}`);
}

const elements = JSON.parse(await readFile(file, 'utf8')).elements;
const have = new Map();
for (const t of elements) {
  const key = `${t.state}|${norm(t.tags?.name || '')}`;
  if (norm(t.tags?.name || '')) have.set(key, true);
}

const added = [];
for (const page of PAGES) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page.title)}&prop=wikitext&format=json&formatversion=2`;
  const wikitext = await fetchWikitext(url);
  let fresh = 0, dup = 0;
  for (const name of new Set(entriesFrom(wikitext))) {
    const key = `${page.state}|${norm(name)}`;
    if (!norm(name) || have.has(key)) { dup++; continue; }
    have.set(key, true);
    const id = Number(BigInt('0x' + (await sha(`${page.title}|${name}`)).slice(0, 12)) % 9007199254740991n);
    added.push({
      type: 'wikipedia',
      id,
      tags: { name, religion: 'hindu', amenity: 'place_of_worship', source_page: page.title },
      state: page.state,
      state_basis: 'wikipedia_list',
      ...(page.district ? { district: page.district, district_basis: 'wikipedia_list' } : {}),
      located: false,
      batch: BATCH,
    });
    fresh++;
  }
  console.log(`${page.title}: ${fresh} new, ${dup} already held or unusable`);
}

async function sha(text) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text).digest('hex');
}

console.log(`total new name-only records: ${added.length}`);
if (DRY && process.env.PREVIEW) await writeFile(process.env.PREVIEW, added.map((a) => `${a.state} | ${a.tags.source_page} | ${a.tags.name}`).join('\n'));
if (!DRY && added.length) {
  const kept = elements.filter((t) => t.batch !== BATCH);
  const data = JSON.parse(await readFile(file, 'utf8'));
  data.elements = [...kept, ...added];
  await writeFile(file, JSON.stringify(data, null, 0));
  console.log(`wrote ${data.elements.length} elements to india-temples.json`);
}
