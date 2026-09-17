/**
 * Command-line bulk importer — the path for first-time setup and large batches.
 *
 *   npm run import -- <file.xlsx> [--dry-run] [--as <username>]
 *
 * Unlike the admin upload page this has no session, no upload size limit and no
 * request timeout, and it writes plain files you can review with `git diff`
 * before committing. Behaviour is otherwise identical: rows are matched to
 * existing temples on temple_id, nothing is ever published, and updating a live
 * entry pulls it back to "pending" for re-review.
 */
import fs from "node:fs";
import path from "node:path";
import { parseTempleWorkbook } from "@/lib/excel/parse";
import { upsertTempleFromImport } from "@/lib/temples";
import { validateTemple } from "@/lib/validate";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const asIndex = args.indexOf("--as");
const SUBMITTED_BY = asIndex >= 0 ? (args[asIndex + 1] ?? "import") : "import";
const file = args.find((a) => !a.startsWith("--") && a !== SUBMITTED_BY);

if (!file) {
  console.error("Usage: npm run import -- <file.xlsx> [--dry-run] [--as <username>]");
  process.exit(2);
}
if (!fs.existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(2);
}

console.log(`Reading ${path.relative(process.cwd(), file)}\n`);
const { temples, issues } = await parseTempleWorkbook(fs.readFileSync(file));

const errors = issues.filter((i) => i.level === "error");
const warnings = issues.filter((i) => i.level === "warning");

for (const issue of errors) {
  console.log(`  error   ${issue.sheet}!${issue.row} ${issue.column ?? ""}: ${issue.message}`);
}
for (const issue of warnings.slice(0, 40)) {
  console.log(`  warning ${issue.sheet}!${issue.row} ${issue.column ?? ""}: ${issue.message}`);
}
if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more warnings`);
if (issues.length) console.log();

if (temples.length === 0) {
  console.error("No temple rows were read from 01_Temple_Master.");
  process.exit(1);
}

let created = 0;
let updated = 0;
let unchanged = 0;
let unpublished = 0;
const skipped: string[] = [];

for (const temple of temples) {
  const name = temple.identity.nameEn || temple.templeId;
  if (!temple.identity.nameEn) {
    skipped.push(`${temple.templeId}: temple_name_en is empty`);
    continue;
  }

  const blockers = validateTemple(temple).filter((i) => i.level === "error");
  const gaps = blockers.length ? `  (${blockers.length} required field(s) still empty)` : "";

  if (DRY) {
    console.log(`  ~ ${name}${gaps}`);
    continue;
  }

  try {
    const outcome = upsertTempleFromImport(temple, SUBMITTED_BY);
    if (outcome.action === "created") created += 1;
    else if (outcome.action === "updated") updated += 1;
    else unchanged += 1;
    if (outcome.unpublished) unpublished += 1;

    if (outcome.action === "unchanged") continue; // nothing to say about a no-op
    const mark = outcome.action === "created" ? "+" : "~";
    const note = outcome.unpublished ? "  [taken off the site for re-review]" : "";
    console.log(`  ${mark} ${outcome.temple.slug.padEnd(38)} ${name}${gaps}${note}`);
  } catch (error) {
    skipped.push(`${name}: ${(error as Error).message}`);
  }
}

for (const reason of skipped) console.log(`  ! skipped ${reason}`);

console.log(
  `\n${DRY ? "DRY RUN — nothing written. " : ""}` +
    `${created} created, ${updated} updated, ${unchanged} unchanged, ${skipped.length} skipped` +
    (unpublished ? `, ${unpublished} pulled back to "pending"` : "") +
    `, ${errors.length} error(s), ${warnings.length} warning(s).`
);
if (!DRY) console.log("Review with: git diff --stat data/temples/");

process.exit(errors.length > 0 || skipped.length > 0 ? 1 : 0);
