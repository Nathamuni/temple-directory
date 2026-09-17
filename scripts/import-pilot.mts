/**
 * Loads the researched Chidambaram record out of
 * Temple_Directory_Input_Schema.xlsx and writes it over the thin
 * data/temples/chidambaram-nataraja.json entry, so one temple in the
 * directory exercises every section of the new page.
 *
 *   npx tsx scripts/import-pilot.mts [--dry-run]
 *
 * The existing slug is kept so the published URL does not change.
 */
import fs from "node:fs";
import path from "node:path";
import { parseTempleWorkbook } from "@/lib/excel/parse";
import { readWorkbook } from "@/lib/excel/workbook";
import type { Temple } from "@/lib/types";

const DRY = process.argv.includes("--dry-run");
const ROOT = process.cwd();
const WORKBOOK = path.join(ROOT, "Temple_Directory_Input_Schema.xlsx");
const TARGET = path.join(ROOT, "data", "temples", "chidambaram-nataraja.json");
const KEEP_SLUG = "chidambaram-nataraja";

/**
 * Known defect in the supplied workbook: in 06_Pooja_Seva, the PUJ001 row is
 * shifted one column left from `linked_media_ids` onward, so the source ids
 * land in linked_media_ids, the date in source_ids and the status in
 * last_verified_date. Rows PUJ002-PUJ008 are correct.
 *
 * The parser rightly refuses to treat "SRC007" as a media link and drops it,
 * so the repair is applied here, against the raw sheet, and only when the
 * exact signature is present. Fix the workbook and this becomes a no-op.
 */
async function repairShiftedPoojaRow(temple: Temple, buffer: Buffer): Promise<string[]> {
  const notes: string[] = [];
  const workbook = await readWorkbook(buffer);
  const sheet = workbook.getWorksheet("06_Pooja_Seva");
  if (!sheet) return notes;

  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => headers.set(String(cell.text).trim(), col));
  const idCol = headers.get("pooja_id");
  const linkedCol = headers.get("linked_media_ids");
  const sourceCol = headers.get("source_ids");
  if (!idCol || !linkedCol || !sourceCol) return notes;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const poojaId = String(row.getCell(idCol).text ?? "").trim();
    if (!poojaId) continue;

    const linked = String(row.getCell(linkedCol).text ?? "").trim();
    const sourceCell = String(row.getCell(sourceCol).text ?? "").trim();
    const shifted = /^SRC\d/.test(linked) && !/^SRC\d/.test(sourceCell);
    if (!shifted) continue;

    const pooja = temple.poojas.find((p) => p.poojaId === poojaId);
    if (!pooja) continue;
    pooja.sourceIds = linked.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    pooja.linkedMediaIds = [];
    pooja.lastVerifiedDate = "2026-09-17";
    pooja.verificationStatus = "needs recheck";
    notes.push(
      `${poojaId}: 06_Pooja_Seva row ${rowNumber} is shifted one column; ` +
        `moved ${pooja.sourceIds.join(", ")} from linked_media_ids into source_ids`
    );
  }
  return notes;
}

const workbookBuffer = fs.readFileSync(WORKBOOK);
const result = await parseTempleWorkbook(workbookBuffer);

for (const issue of result.issues) {
  console.log(`  ${issue.level} ${issue.sheet}!${issue.row} ${issue.column ?? ""}: ${issue.message}`);
}

const temple = result.temples[0];
if (!temple) {
  console.error("No temple rows found in 01_Temple_Master.");
  process.exit(1);
}

const repairs = await repairShiftedPoojaRow(temple, workbookBuffer);
for (const note of repairs) console.log(`  repair ${note}`);

// Keep the live URL, and carry over the product-only fields from the entry
// being replaced so the lamp widget and nearby list are not lost.
const existing = fs.existsSync(TARGET)
  ? (JSON.parse(fs.readFileSync(TARGET, "utf8")) as Partial<Temple>)
  : undefined;
temple.slug = KEEP_SLUG;
temple.status = existing?.status ?? "published";
if (existing?.extensions) {
  temple.extensions = { ...temple.extensions, ...existing.extensions };
}
if (existing?.submittedBy) temple.submittedBy = existing.submittedBy;

if (!DRY) fs.writeFileSync(TARGET, JSON.stringify(temple, null, 2) + "\n", "utf8");

console.log(
  `\n${DRY ? "DRY RUN — nothing written. " : "wrote "}${path.relative(ROOT, TARGET)}` +
    `\n  ${temple.templeId} · ${temple.identity.nameEn} · status ${temple.status}` +
    `\n  hours:${temple.openingHours.length} sop:${temple.worshipSop.length} shrines:${temple.shrines.length}` +
    ` poojas:${temple.poojas.length} festivals:${temple.festivals.length} media:${temple.media.length} sources:${temple.sources.length}`
);
