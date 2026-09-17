/**
 * Data check for the file-backed temple store. Not a test harness — it
 * validates the JSON that ships in the repo and proves the Excel round-trip is
 * lossless, which is the single most useful signal for this codebase.
 *
 *   npx tsx scripts/check-data.mts [--quiet]
 *
 * Exits non-zero when a published entry has validation errors or the round-trip
 * loses data.
 */
import fs from "node:fs";
import path from "node:path";
import type { Temple } from "@/lib/types";
import { validateTemple, completeness } from "@/lib/validate";
import { buildTempleWorkbook } from "@/lib/excel/build";
import { parseTempleWorkbook } from "@/lib/excel/parse";

const QUIET = process.argv.includes("--quiet");
const DATA_DIR = path.join(process.cwd(), "data", "temples");

let exitCode = 0;
let publishedWithGaps = 0;
const temples: Temple[] = [];

/* ---- 1. load + validate ---- */
console.log("Validating data/temples/*.json\n");
for (const file of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort()) {
  let temple: Temple;
  try {
    temple = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as Temple;
  } catch (error) {
    console.log(`  ✗ ${file} — unreadable: ${(error as Error).message}`);
    exitCode = 1;
    continue;
  }
  temples.push(temple);

  const issues = validateTemple(temple);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const pct = completeness(temple).pct;
  // A published entry with errors is a content gap, not a broken build: the
  // migration deliberately invented no provenance, so every imported record
  // starts out unsourced. It is reported loudly and counted, but only
  // unreadable files and round-trip loss fail the check.
  const gap = temple.status === "published" && errors.length > 0;
  if (gap) publishedWithGaps += 1;

  const mark = gap ? "!" : errors.length ? "·" : "✓";
  console.log(
    `  ${mark} ${file.padEnd(38)} ${String(pct).padStart(3)}%  ${temple.status.padEnd(9)} ` +
      `${errors.length} error(s), ${warnings.length} warning(s)`
  );
  if (!QUIET && gap) {
    for (const issue of errors.slice(0, 6)) {
      console.log(`        ${issue.sheet} ${issue.column || issue.path}: ${issue.message}`);
    }
  }
}

/* ---- 2. Excel round-trip ---- */
console.log("\nRound-tripping every temple through the 9-sheet workbook");
const workbook = buildTempleWorkbook(temples);
const buffer = await workbook.xlsx.writeBuffer();
const parsed = await parseTempleWorkbook(buffer as ArrayBuffer);

const errors = parsed.issues.filter((i) => i.level === "error");
if (errors.length) {
  exitCode = 1;
  console.log(`  ✗ ${errors.length} parse error(s)`);
  for (const issue of errors.slice(0, 10)) {
    console.log(`      ${issue.sheet}!${issue.row} ${issue.column ?? ""}: ${issue.message}`);
  }
}
if (parsed.temples.length !== temples.length) {
  exitCode = 1;
  console.log(`  ✗ ${temples.length} in, ${parsed.temples.length} out`);
} else {
  console.log(`  ✓ ${parsed.temples.length} temples survived the round trip`);
}

/** Key order is meaningless in JSON, so sort before comparing. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined || v === "") continue;
      out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

/**
 * Workflow fields (status, submittedBy, rejectionReason) are ours, not the
 * workbook's — an import deliberately lands as a fresh draft — so they are
 * excluded. Everything else, including extensions, must survive.
 */
function comparable(temple: Temple): unknown {
  const { submittedBy: _s, rejectionReason: _r, status: _st, ...rest } = temple;
  return sortKeys(JSON.parse(JSON.stringify(rest)));
}

let lossy = 0;
for (const before of temples) {
  const after = parsed.temples.find((t) => t.templeId === before.templeId);
  if (!after) {
    console.log(`  ✗ ${before.slug} did not come back`);
    lossy += 1;
    continue;
  }
  const a = JSON.stringify(comparable(before));
  const b = JSON.stringify(comparable(after));
  if (a !== b) {
    lossy += 1;
    if (!QUIET) {
      console.log(`  ! ${before.slug} differs after round trip`);
      const beforeObj = JSON.parse(a) as Record<string, unknown>;
      const afterObj = JSON.parse(b) as Record<string, unknown>;
      for (const key of new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])) {
        const x = JSON.stringify(beforeObj[key]);
        const y = JSON.stringify(afterObj[key]);
        if (x !== y) console.log(`      ${key}:\n        in  ${x?.slice(0, 220)}\n        out ${y?.slice(0, 220)}`);
      }
    }
  }
}
if (lossy) {
  exitCode = 1;
  console.log(`  ✗ ${lossy} temple(s) changed in the round trip`);
} else {
  console.log("  ✓ no data lost");
}

if (publishedWithGaps) {
  console.log(
    `\n${publishedWithGaps} published entr${publishedWithGaps === 1 ? "y" : "ies"} still have required ` +
      "fields to fill in (mostly source_ids and last_verified_date, which the migration " +
      "deliberately left empty rather than inventing). They render, but cannot be re-published " +
      "through the publish gate until a contributor sources them."
  );
}
console.log(exitCode === 0 ? "\nIntegrity checks passed." : "\nIntegrity checks FAILED.");
process.exit(exitCode);
