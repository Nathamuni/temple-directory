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
  { title: 'List of Hindu temples in Tirupati', state: 'Andhra Pradesh', district: 'Tirupati' },
  { title: 'List of Hindu temples in Kumbakonam', state: 'Tamil Nadu', district: 'Thanjavur' },
  { title: 'List of Hindu temples in Bareilly', state: 'Uttar Pradesh', district: 'Bareilly' },
  { title: 'List of Hindu temples in Bishnupur', state: 'West Bengal', district: 'Bankura' },
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
// Per state: exact normalised names, plus the word sets of every name, to catch spelling variants such as
// "Oorali Appooppan Kavu" inside "Sree Kalleli Oorali Appooppan Kavu".
const have = new Set();
const wordSets = new Map();
const words = (s) => norm(s).split(' ').filter((w) => w.length >= 3);
function indexExisting(state, name) {
  have.add(`${state}|${norm(name)}`);
  if (!wordSets.has(state)) wordSets.set(state, []);
  wordSets.get(state).push(new Set(words(name)));
}
for (const t of elements) {
  if (t.batch === BATCH) continue; // this batch is rebuilt below, so its own records must not count as duplicates
  if (t.tags?.name) indexExisting(t.state, t.tags.name);
}
function isDuplicate(state, name) {
  if (have.has(`${state}|${norm(name)}`)) return true;
  const mine = new Set(words(name));
  if (mine.size === 0) return true;
  // A single shared word is too weak unless it is distinctive (6+ letters); two or more shared words count.
  const strong = (set) => set.size >= 2 || [...set].some((w) => w.length >= 6);
  return (wordSets.get(state) || []).some((theirs) => {
    const [small, big] = mine.size <= theirs.size ? [mine, theirs] : [theirs, mine];
    return strong(small) && [...small].every((w) => big.has(w));
  });
}

// The main India list has one section per state. Level-2 headings name the state; level-3 headings stay inside it.
const INDIA_TITLE = 'List of Hindu temples in India';
const INDIA_SKIP = /^(see also|references|external links|notes|gallery|further reading)$/i;
async function indiaStateSections() {
  const text = await fetchWikitext(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(INDIA_TITLE)}&prop=wikitext&format=json&formatversion=2`);
  const sections = [];
  let open = false;
  for (const line of text.split('\n')) {
    const h2 = line.match(/^==\s*([^=].*?)\s*==\s*$/);
    if (h2) {
      open = !INDIA_SKIP.test(h2[1]);
      if (open) sections.push({ state: h2[1], lines: [] });
      continue;
    }
    if (open) sections.at(-1).lines.push(line);
  }
  return sections;
}

const jobs = PAGES.map((p) => ({
  label: p.title, state: p.state, district: p.district,
  names: async () => entriesFrom(await fetchWikitext(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(p.title)}&prop=wikitext&format=json&formatversion=2`)),
}));
for (const s of await indiaStateSections()) {
  jobs.push({ label: `${INDIA_TITLE} / ${s.state}`, state: s.state, district: null, names: async () => entriesFrom(s.lines.join('\n')) });
}

const added = [];
for (const job of jobs) {
  let fresh = 0, dup = 0;
  for (const name of new Set(await job.names())) {
    if (isDuplicate(job.state, name)) { dup++; continue; }
    indexExisting(job.state, name);
    const id = Number(BigInt('0x' + (await sha(`${job.label}|${name}`)).slice(0, 12)) % 9007199254740991n);
    added.push({
      type: 'wikipedia',
      id,
      tags: { name, religion: 'hindu', amenity: 'place_of_worship', source_page: job.label },
      state: job.state,
      state_basis: 'wikipedia_list',
      ...(job.district ? { district: job.district, district_basis: 'wikipedia_list' } : {}),
      located: false,
      batch: BATCH,
    });
    fresh++;
  }
  console.log(`${job.label}: ${fresh} new, ${dup} already held or unusable`);
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
