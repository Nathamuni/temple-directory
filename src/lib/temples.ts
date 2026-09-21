import fs from "fs";
import path from "path";
import type { Temple, TempleStatus } from "./types";
import { blankTemple } from "./blankTemple";
import { canPublish, validateTemple, type ValidationIssue } from "./validate";
import { TEMPLES_DIR, ensureDataDir } from "./dataDir";

/**
 * Resolved at call time rather than module load: on a hosted deploy the
 * directory lives on a mounted disk that is seeded on first use.
 */
function dataDir(): string {
  ensureDataDir();
  return TEMPLES_DIR;
}

export class TempleDataError extends Error {
  constructor(slug: string, message: string) {
    super(`Temple data error [${slug}]: ${message}`);
    this.name = "TempleDataError";
  }
}

function fail(slug: string, message: string): never {
  throw new TempleDataError(slug, message);
}

/** A file that could not be read at all, kept so admins can see it on /status. */
export interface LoadFailure {
  file: string;
  message: string;
}

interface Cache {
  temples: Temple[];
  failures: LoadFailure[];
}

let cache: Cache | null = null;

/**
 * Reads every temple file.
 *
 * A malformed file is skipped and recorded rather than thrown, because this
 * loader backs the home page, every browse page, the sitemap and the status
 * page — one bad file used to take all of them down. Hard failure now lives
 * only in the publish gate, where it belongs.
 */
function load(): Cache {
  if (cache) return cache;

  const temples: Temple[] = [];
  const failures: LoadFailure[] = [];

  const files = fs.existsSync(dataDir())
    ? fs.readdirSync(dataDir()).filter((f) => f.endsWith(".json")).sort()
    : [];

  for (const file of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dataDir(), file), "utf8")) as Temple;
      if (!parsed.slug) throw new Error('missing "slug"');
      if (!parsed.identity) throw new Error('missing "identity" — file predates the 9-sheet schema');
      const STATUSES: TempleStatus[] = ["draft", "pending", "verified", "published", "rejected"];
      if (!STATUSES.includes(parsed.status)) {
        throw new Error(`status must be one of ${STATUSES.join(" | ")} (found "${parsed.status}")`);
      }
      temples.push(normalize(parsed));
    } catch (error) {
      failures.push({ file, message: (error as Error).message });
    }
  }

  cache = { temples, failures };
  return cache;
}

/** Fills in arrays a hand-edited file may have omitted, so components need no guards. */
function normalize(temple: Temple): Temple {
  const base = blankTemple();
  return {
    ...base,
    ...temple,
    identity: { ...base.identity, ...temple.identity },
    location: { ...base.location, ...temple.location },
    governance: { ...base.governance, ...temple.governance },
    narrative: { ...base.narrative, ...temple.narrative },
    editorial: { ...base.editorial, ...temple.editorial },
    visitingInfo: { ...base.visitingInfo, ...temple.visitingInfo },
    openingHours: temple.openingHours ?? [],
    worshipSop: temple.worshipSop ?? [],
    shrines: temple.shrines ?? [],
    poojas: temple.poojas ?? [],
    festivals: temple.festivals ?? [],
    media: temple.media ?? [],
    sources: temple.sources ?? [],
    extensions: { ...base.extensions, ...temple.extensions },
  };
}

export function getAllTemples(): Temple[] {
  return load().temples;
}

/** Files that could not be loaded — surfaced to admins, never to the public. */
export function getDataErrors(): LoadFailure[] {
  return load().failures;
}

/** Only what's actually live on the public site. */
export function getPublishedTemples(): Temple[] {
  return getAllTemples().filter((t) => t.status === "published");
}

export function getTemple(slug: string): Temple | undefined {
  return getAllTemples().find((t) => t.slug === slug);
}

export function getTemplesBySubmitter(username: string): Temple[] {
  return getAllTemples().filter((t) => t.submittedBy === username);
}

export { completeness, validateTemple, canPublish } from "./validate";
export type { ValidationIssue, Completeness } from "./validate";

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

function writeTempleFile(temple: Temple): void {
  fs.writeFileSync(
    path.join(dataDir(), `${temple.slug}.json`),
    JSON.stringify(temple, null, 2) + "\n",
    "utf8"
  );
  cache = null; // next load() re-reads from disk
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueSlug(base: string): string {
  const existing = new Set(
    fs.existsSync(dataDir())
      ? fs.readdirSync(dataDir()).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
      : []
  );
  let slug = base || "temple";
  let n = 2;
  while (existing.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

/** TPL-IN-<STATE>-<CITY>-NNNN, matching the workbook's own id convention. */
function nextTempleId(temple: Temple): string {
  const letters = (value: string) => value.replace(/[^a-zA-Z ]/g, "").trim();
  const words = letters(temple.location.stateProvince).split(/\s+/).filter(Boolean);
  const state = (words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 2)) || "XX";
  const city = letters(temple.location.city).replace(/\s+/g, "").slice(0, 3) || "XXX";
  const country = temple.location.country?.toLowerCase() === "india" ? "IN" : letters(temple.location.country).slice(0, 2).toUpperCase() || "XX";
  const prefix = `TPL-${country}-${state.toUpperCase().slice(0, 3)}-${city.toUpperCase()}`;
  const taken = new Set(getAllTemples().map((t) => t.templeId));
  let n = 1;
  while (taken.has(`${prefix}-${String(n).padStart(4, "0")}`)) n += 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

/**
 * Creates a new entry from a contributor draft. Always lands as "draft",
 * whatever the submitted payload claims — contributions never self-publish.
 */
export function createDraftTemple(draft: Temple, submittedBy: string): Temple {
  const slug = uniqueSlug(slugify(draft.slug || draft.identity.nameEn));
  const temple: Temple = {
    ...draft,
    slug,
    status: "draft",
    submittedBy,
    templeId: draft.templeId || nextTempleId(draft),
  };
  delete temple.rejectionReason;
  writeTempleFile(temple);
  return temple;
}

/**
 * Editable statuses — a submission is only "yours to revise" before it's
 * been reviewed (draft) or after it's been sent back (rejected).
 */
const EDITABLE_STATUSES: TempleStatus[] = ["draft", "rejected"];

/**
 * Revises a contributor's own draft/rejected entry and always sends it back to
 * "pending": an edit is a fresh submission needing fresh approval, so any
 * prior rejection reason is cleared.
 */
export function updateDraftTemple(slug: string, submittedBy: string, draft: Temple): Temple {
  const existing = getTemple(slug);
  if (!existing) fail(slug, "temple not found");
  if (existing.submittedBy !== submittedBy) fail(slug, "you can only edit your own submissions");
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    fail(slug, `cannot edit an entry with status "${existing.status}"`);
  }

  const temple: Temple = {
    ...draft,
    slug: existing.slug,
    templeId: existing.templeId,
    submittedBy: existing.submittedBy,
    status: "pending",
  };
  delete temple.rejectionReason;
  writeTempleFile(temple);
  return temple;
}

export interface ImportOutcome {
  temple: Temple;
  /**
   * "created" for a new entry, "updated" when an existing temple_id matched and
   * the content differs, "unchanged" when it matched but nothing changed.
   */
  action: "created" | "updated" | "unchanged";
  /** Set when an update pulled a live entry back for re-review. */
  unpublished?: boolean;
}

/**
 * Content equality, ignoring the fields an import does not own. Re-importing an
 * unedited export should be a no-op, not an event that takes two dozen live
 * temples off the site.
 */
function sameContent(a: Temple, b: Temple): boolean {
  // Key order differs between a file read from disk and an object built by the
  // parser, so compare a canonical form with keys sorted at every depth.
  // (Passing a key array to JSON.stringify would not work here: it filters
  // keys rather than ordering them, and would silently drop nested objects.)
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        const inner = (value as Record<string, unknown>)[key];
        if (inner === undefined || inner === "") continue;
        out[key] = canonical(inner);
      }
      return out;
    }
    return value;
  };
  const strip = (t: Temple) => {
    const { status: _s, slug: _sl, submittedBy: _sb, rejectionReason: _r, ...rest } = t;
    return JSON.stringify(canonical(rest));
  };
  return strip(a) === strip(b);
}

/**
 * Status an imported change lands on. A workbook edit must never silently
 * alter what the public sees, so a live entry drops back to "pending" for
 * re-review; work still in progress keeps its place in the pipeline.
 */
function statusAfterImport(current: TempleStatus): TempleStatus {
  switch (current) {
    case "published":
    case "verified":
    case "rejected":
      return "pending";
    default:
      return current;
  }
}

/**
 * Writes one temple from a parsed workbook, matching on `temple_id`.
 *
 * Matching is what makes export → edit in Excel → re-import a usable loop.
 * Without it every re-import duplicated the entire directory, because each row
 * took a fresh `-2` slug.
 *
 * Import never publishes: a new entry lands as a draft, and an updated live
 * entry is pulled back to "pending".
 */
export function upsertTempleFromImport(temple: Temple, submittedBy: string): ImportOutcome {
  const existing = temple.templeId
    ? getAllTemples().find((t) => t.templeId === temple.templeId)
    : undefined;

  if (!existing) {
    const slug = uniqueSlug(slugify(temple.slug || temple.identity.nameEn));
    const created: Temple = {
      ...temple,
      slug,
      status: "draft",
      submittedBy,
      templeId: temple.templeId || nextTempleId(temple),
    };
    delete created.rejectionReason;
    writeTempleFile(created);
    return { temple: created, action: "created" };
  }

  // Only an actual content change warrants re-review.
  const candidate: Temple = {
    ...temple,
    slug: existing.slug,
    templeId: existing.templeId,
    submittedBy: existing.submittedBy ?? submittedBy,
    status: existing.status,
  };
  delete candidate.rejectionReason;
  if (sameContent(candidate, existing)) {
    return { temple: existing, action: "unchanged" };
  }

  const nextStatus = statusAfterImport(existing.status);
  const updated: Temple = {
    ...temple,
    // The slug is the public URL and the filename; an import must not move it.
    slug: existing.slug,
    templeId: existing.templeId,
    submittedBy: existing.submittedBy ?? submittedBy,
    status: nextStatus,
  };
  delete updated.rejectionReason;
  writeTempleFile(updated);
  return {
    temple: updated,
    action: "updated",
    unpublished: existing.status !== nextStatus,
  };
}

const STATUS_ORDER: TempleStatus[] = ["draft", "pending", "verified", "published", "rejected"];
const FULL_VALIDITY_STATUSES: TempleStatus[] = ["verified", "published"];

export interface StatusChangeResult {
  ok: boolean;
  temple?: Temple;
  blockers?: ValidationIssue[];
  error?: string;
}

/**
 * Moves a temple to a new editorial status. Promoting to "verified" or
 * "published" runs the full publish gate first and returns its blockers to the
 * admin UI rather than throwing, so a broken entry produces a readable list
 * instead of a 500.
 */
export function updateTempleStatus(
  slug: string,
  next: TempleStatus,
  reason?: string
): StatusChangeResult {
  if (!STATUS_ORDER.includes(next)) return { ok: false, error: `invalid status "${next}"` };
  if (next === "rejected" && !reason?.trim()) {
    return { ok: false, error: "a reason is required to reject an entry" };
  }
  const existing = getTemple(slug);
  if (!existing) return { ok: false, error: "temple not found" };

  if (FULL_VALIDITY_STATUSES.includes(next)) {
    const gate = canPublish({ ...existing, status: next });
    if (!gate.ok) return { ok: false, blockers: gate.blockers, error: `${gate.blockers.length} required field(s) still missing` };
  }

  const temple: Temple = { ...existing, status: next };
  if (next === "rejected") temple.rejectionReason = reason!.trim();
  else delete temple.rejectionReason;

  writeTempleFile(temple);
  return { ok: true, temple };
}

/** Validation issues for an entry, for the contributor's readiness panel. */
export function issuesFor(slug: string): ValidationIssue[] {
  const temple = getTemple(slug);
  return temple ? validateTemple(temple) : [];
}

/* ------------------------------------------------------------------ *
 * Facets
 * ------------------------------------------------------------------ */

export type Facet = "deity" | "state" | "type" | "tradition";

export const FACET_LABELS: Record<Facet, string> = {
  deity: "Deity",
  state: "State",
  type: "Temple Type",
  tradition: "Tradition",
};

export function facetValue(temple: Temple, facet: Facet): string {
  switch (facet) {
    case "deity":
      return temple.identity.presidingDeity;
    case "state":
      return temple.location.stateProvince;
    case "type":
      return temple.identity.templeType;
    case "tradition":
      return temple.identity.tradition;
  }
}

export function getFacetValues(facet: Facet): { value: string; slug: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const temple of getPublishedTemples()) {
    const value = facetValue(temple, facet);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, slug: slugify(value), count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function getTemplesByFacet(facet: Facet, value: string): Temple[] {
  return getPublishedTemples().filter(
    (t) => slugify(facetValue(t, facet)) === slugify(value)
  );
}
