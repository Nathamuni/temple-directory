/**
 * Merges researched enrichment files into data/temples/.
 *
 *   npx tsx scripts/apply-enrichment.mts [--dry-run] [--only <slug>] [--dir <patch dir>]
 *
 * --dir defaults to research/enrichment; research/mantras holds the
 * temple-specific hymn patches (sources + mantras only).
 *
 * Research agents write one patch per temple into research/enrichment/<slug>.json
 * and never touch data/temples/ themselves — concurrent writers would corrupt the
 * store, and merging is a judgement the main thread keeps.
 *
 * Merge rules, in order of importance:
 *   - templeId, slug, status, submittedBy are never changed. Enrichment cannot
 *     publish anything or move an entry through the editorial pipeline.
 *   - Existing non-empty values win. A patch fills gaps; it does not overwrite
 *     content someone already curated.
 *   - Sources merge first and are de-duplicated by URL. Child records then have
 *     their sourceIds remapped onto the merged ids, and any reference that does
 *     not resolve is dropped rather than left dangling.
 *   - Records arrive with agent-local ids; they are renumbered on the way in.
 */
import fs from "node:fs";
import path from "node:path";
import type { MediaItem, SourceRecord, Temple } from "@/lib/types";
import { validateTemple, completeness } from "@/lib/validate";
import { FIELD_SPECS, type SheetId } from "@/lib/schema";

/**
 * Keys the schema actually defines, per sheet. A research agent that invents a
 * field is not just untidy — the value would be silently lost on the next
 * Excel export, so it is dropped here and reported instead of stored.
 */
function schemaKeys(sheet: SheetId): Set<string> {
  return new Set(
    FIELD_SPECS.filter((f) => f.sheet === sheet && f.path)
      .map((f) => f.path!.split(".").pop()!)
  );
}

const SHEET_FOR: Record<string, SheetId> = {
  visitingInfo: "02_Visiting_Info",
  openingHours: "03_Opening_Hours",
  worshipSop: "04_Worship_SOP",
  shrines: "05_Shrines_Route",
  poojas: "06_Pooja_Seva",
  festivals: "07_Festivals",
  media: "08_Media",
  sources: "09_Sources",
  mantras: "13_Mantras",
};

/** Array fields every record of a sheet must carry, so records normalise identically. */
const ARRAY_DEFAULTS: Partial<Record<SheetId, string[]>> = {
  "03_Opening_Hours": ["sourceIds"],
  "04_Worship_SOP": ["sourceIds", "linkedShrineIds", "linkedMediaIds"],
  "05_Shrines_Route": ["sourceIds", "linkedMediaIds"],
  "06_Pooja_Seva": ["sourceIds", "linkedMediaIds"],
  "07_Festivals": ["sourceIds", "linkedMediaIds"],
  "13_Mantras": ["sourceIds", "linkedShrineIds"],
};

function pruneToSchema(
  record: Bag,
  sheet: SheetId,
  dropped: string[],
  label: string,
  editorNotes?: string[]
): Bag {
  const allowed = schemaKeys(sheet);
  const out: Bag = {};
  for (const [key, value] of Object.entries(record)) {
    if (allowed.has(key)) {
      out[key] = value;
      continue;
    }
    // Researchers consistently record source conflicts and unsupported legacy
    // figures as a free-text `notes`. On a sheet with no notes column that is
    // still editorial signal worth keeping, so it is re-homed onto
    // editorial.verification_notes rather than thrown away.
    if (/^(notes?|sourceTypeNote|note)$/i.test(key) && typeof value === "string" && value.trim() && editorNotes) {
      editorNotes.push(value.trim());
      continue;
    }
    dropped.push(`${label}.${key} = ${JSON.stringify(value).slice(0, 160)}`);
  }
  for (const field of ARRAY_DEFAULTS[sheet] ?? []) {
    if (!Array.isArray(out[field])) out[field] = [];
  }
  return out;
}

const DRY = process.argv.includes("--dry-run");
const onlyIndex = process.argv.indexOf("--only");
const ONLY = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : undefined;

const dirIndex = process.argv.indexOf("--dir");
const PATCH_DIR = path.resolve(dirIndex >= 0 ? process.argv[dirIndex + 1] : path.join("research", "enrichment"));
const DATA_DIR = path.join(process.cwd(), "data", "temples");

type Patch = Partial<Temple> & { slug?: string };
type Bag = Record<string, unknown>;

const pad = (n: number, w = 3) => String(n).padStart(w, "0");

/** Fills only keys the target is missing; never clobbers existing content. */
function fillGaps(target: Bag, patch: Bag | undefined, filled: string[], prefix: string): void {
  if (!patch) return;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      const existing = target[key];
      if (!Array.isArray(existing) || existing.length === 0) {
        if (value.length) {
          target[key] = value;
          filled.push(`${prefix}${key}`);
        }
      }
      continue;
    }
    if (typeof value === "object") {
      if (typeof target[key] !== "object" || target[key] === null) target[key] = {};
      fillGaps(target[key] as Bag, value as Bag, filled, `${prefix}${key}.`);
      continue;
    }
    const current = target[key];
    // "unverified" is the default a record is born with, not a finding. A
    // researched status must be able to replace it, or every enrichment would
    // leave the page claiming nothing was checked.
    const isPlaceholder =
      current === undefined ||
      current === null ||
      current === "" ||
      (key === "verificationStatus" && current === "unverified");
    if (isPlaceholder) {
      target[key] = value;
      filled.push(`${prefix}${key}`);
    }
  }
}

/** A source is the same source if it points at the same page. */
function sourceKey(source: SourceRecord): string {
  return (source.url || source.archivedUrl || source.title || "").trim().toLowerCase();
}

function mergeSources(
  temple: Temple,
  incoming: SourceRecord[] | undefined,
  dropped: string[]
): { map: Map<string, string>; added: number } {
  const map = new Map<string, string>();
  let added = 0;
  if (!incoming?.length) return { map, added };

  const byKey = new Map(temple.sources.map((s) => [sourceKey(s), s]));
  let next = temple.sources.length;

  for (const source of incoming) {
    const key = sourceKey(source);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      map.set(source.sourceId, existing.sourceId);
      continue;
    }
    next += 1;
    const id = `SRC${pad(next)}`;
    // Sources merge on their own path, so they need the same schema pruning the
    // other sheets get. A caveat about how a source may be used belongs in
    // reliability_note, which the schema already has.
    const notes: string[] = [];
    const pruned = pruneToSchema(
      source as unknown as Bag,
      "09_Sources",
      dropped,
      `sources.${source.sourceId}`,
      notes
    );
    if (notes.length) {
      const existing = String(pruned.reliabilityNote ?? "").trim();
      pruned.reliabilityNote = [existing, ...notes].filter(Boolean).join(" ");
    }
    const record: SourceRecord = {
      ...(pruned as unknown as SourceRecord),
      sourceId: id,
      // An editor approves sources, not a research agent.
      adminApproved: false,
    };
    temple.sources.push(record);
    byKey.set(key, record);
    map.set(source.sourceId, id);
    added += 1;
  }
  return { map, added };
}

/** Records cite sources by the agent's local ids; remap and drop what does not resolve. */
function remap(ids: string[] | undefined, map: Map<string, string>, known: Set<string>): string[] {
  if (!ids?.length) return [];
  // De-duplicated: re-running a merge must be idempotent, not append the same
  // citations again.
  return [...new Set(ids.map((id) => map.get(id) ?? id).filter((id) => known.has(id)))];
}

function mediaKey(media: MediaItem): string {
  return (media.fileOrUrl || "").trim().toLowerCase();
}

function apply(slug: string): { ok: boolean; message: string; dropped?: string[] } {
  const patchFile = path.join(PATCH_DIR, `${slug}.json`);
  const dataFile = path.join(DATA_DIR, `${slug}.json`);
  if (!fs.existsSync(dataFile)) return { ok: false, message: "no such temple" };

  let patch: Patch;
  try {
    patch = JSON.parse(fs.readFileSync(patchFile, "utf8")) as Patch;
  } catch (error) {
    return { ok: false, message: `unreadable patch — ${(error as Error).message}` };
  }

  const temple = JSON.parse(fs.readFileSync(dataFile, "utf8")) as Temple;
  const before = completeness(temple).pct;
  const filled: string[] = [];
  const dropped: string[] = [];
  const editorNotes: string[] = [];
  const superseded: string[] = [];

  // 1. Sources first: everything else cites them.
  const { map, added: sourcesAdded } = mergeSources(temple, patch.sources, dropped);
  const knownSources = new Set(temple.sources.map((s) => s.sourceId));

  // 2. Scalar sections.
  for (const section of ["identity", "location", "governance", "narrative", "editorial"] as const) {
    fillGaps(
      temple[section] as unknown as Bag,
      patch[section] as unknown as Bag | undefined,
      filled,
      `${section}.`
    );
  }
  const visiting = patch.visitingInfo
    ? pruneToSchema(patch.visitingInfo as unknown as Bag, "02_Visiting_Info", dropped, "visitingInfo", editorNotes)
    : undefined;
  fillGaps(temple.visitingInfo as unknown as Bag, visiting, filled, "visitingInfo.");
  temple.visitingInfo.sourceIds = remap(
    [...(temple.visitingInfo.sourceIds ?? []), ...((patch.visitingInfo?.sourceIds as string[]) ?? [])],
    map,
    knownSources
  );

  // 3. Repeatable records — only where the temple has none, so curated rows survive.
  const collections: [keyof Temple, string, (item: never, i: number) => string][] = [
    ["openingHours", "hoursId", (_i, i) => `HRS${pad(i + 1)}`],
    ["worshipSop", "sopStepId", (_i, i) => `SOP${pad(i + 1)}`],
    ["shrines", "shrineId", (_i, i) => `SHR${pad(i + 1)}`],
    ["poojas", "poojaId", (_i, i) => `PUJ${pad(i + 1)}`],
    ["festivals", "festivalId", (_i, i) => `FES${pad(i + 1)}`],
    ["mantras", "mantraId", (_i, i) => `MAN${pad(i + 1)}`],
  ];
  for (const [key, idField, mint] of collections) {
    const existing = temple[key] as unknown as Bag[];
    const incoming = (patch[key] as unknown as Bag[] | undefined) ?? [];
    if (incoming.length === 0) continue;

    if (existing.length > 0) {
      // Existing rows that carry no citation are migration residue — the
      // unsourced timings this whole exercise exists to replace. Sourced rows
      // supersede them. Rows that already cite something are somebody's work
      // and are left alone.
      const existingUnsourced = existing.every(
        (record) => !(record.sourceIds as string[] | undefined)?.length
      );
      const incomingSourced = incoming.some(
        (record) => (record.sourceIds as string[] | undefined)?.length
      );
      if (!(existingUnsourced && incomingSourced)) continue;
      superseded.push(`${String(key)}(${existing.length})`);
    }
    const sheet = SHEET_FOR[String(key)];
    (temple[key] as unknown) = incoming.map((record, index) => ({
      ...pruneToSchema(record, sheet, dropped, `${String(key)}[${index}]`, sheet === "03_Opening_Hours" ? undefined : editorNotes),
      [idField]: mint(record as never, index),
      sourceIds: remap(record.sourceIds as string[] | undefined, map, knownSources),
      verificationStatus: record.verificationStatus ?? "unverified",
    }));
    filled.push(`${String(key)}[${incoming.length}]`);
  }

  // 4. Media — appended and de-duplicated by URL, since a hero may already exist.
  if (patch.media?.length) {
    const seen = new Set(temple.media.map(mediaKey));
    let next = temple.media.length;
    for (const item of patch.media) {
      const key = mediaKey(item);
      if (!key || seen.has(key)) continue;
      next += 1;
      temple.media.push({
        ...(pruneToSchema(item as unknown as Bag, "08_Media", dropped, "media") as unknown as MediaItem),
        mediaId: `MED${pad(next)}`,
        // Rights review is an editor's call.
        editorialApproved: false,
        verificationStatus: "pending",
      });
      seen.add(key);
      filled.push(`media[+1]`);
    }
  }

  if (editorNotes.length) {
    const existing = temple.editorial.verificationNotes?.trim();
    const merged = [existing, ...editorNotes].filter(Boolean).join(" ");
    if (merged !== existing) {
      temple.editorial.verificationNotes = merged;
      filled.push("editorial.verificationNotes");
    }
  }

  const issues = validateTemple(temple);
  const errors = issues.filter((i) => i.level === "error").length;
  const after = completeness(temple).pct;

  if (!DRY) fs.writeFileSync(dataFile, JSON.stringify(temple, null, 2) + "\n", "utf8");

  return {
    ok: true,
    dropped,
    message:
      `${String(before).padStart(3)}% -> ${String(after).padStart(3)}%  ` +
      `+${sourcesAdded} sources, ${errors} error(s) left` +
      (superseded.length ? `  {replaced unsourced: ${superseded.join(", ")}}` : "") +
      (filled.length ? `  [${[...new Set(filled)].slice(0, 6).join(", ")}${filled.length > 6 ? ", …" : ""}]` : "  [nothing to fill]"),
  };
}

if (!fs.existsSync(PATCH_DIR)) {
  console.error(`No patches at ${path.relative(process.cwd(), PATCH_DIR)}`);
  process.exit(1);
}

const patches = fs
  .readdirSync(PATCH_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .filter((slug) => !ONLY || slug === ONLY)
  .sort();

if (patches.length === 0) {
  console.log("No enrichment patches found.");
  process.exit(0);
}

console.log(`${DRY ? "DRY RUN — " : ""}applying ${patches.length} patch(es)\n`);
let applied = 0;
for (const slug of patches) {
  const result = apply(slug);
  console.log(`  ${result.ok ? "+" : "!"} ${slug.padEnd(36)} ${result.message}`);
  for (const item of result.dropped ?? []) {
    // Not schema fields: they would vanish on the next Excel export, so they are
    // surfaced here for a human to re-home rather than stored and lost.
    console.log(`      dropped (not in schema): ${item}`);
  }
  if (result.ok) applied += 1;
}
console.log(`\n${applied}/${patches.length} applied.${DRY ? " Nothing written." : " Run: npm run check"}`);
