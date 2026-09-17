import ExcelJS from "exceljs";
import type { Temple } from "../types";
import type { FieldSpec, SheetId } from "../schema";
import { FIELD_SPECS, LOOKUPS, SHEET_COLLECTION, specsForSheet } from "../schema";
import { getPath } from "../paths";
import { writeCell } from "./cells";

/**
 * Builds the 12-sheet workbook: README, the nine data sheets, the generated
 * Column Dictionary and the Lookups. This is both the bulk export and the
 * downloadable template, so the file a contributor fills in is always the same
 * shape as the file they get back.
 */

const SHEET_ORDER: SheetId[] = [
  "01_Temple_Master",
  "02_Visiting_Info",
  "03_Opening_Hours",
  "04_Worship_SOP",
  "05_Shrines_Route",
  "06_Pooja_Seva",
  "07_Festivals",
  "08_Media",
  "09_Sources",
];

const HEADER_FILL = "FF3D0F13";
const HEADER_FONT = "FFF7F0DF";

function styleHeader(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: HEADER_FONT }, size: 10 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (columnCount > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
  }
}

/** Long-text columns get room to breathe; ids stay narrow. */
function widthFor(spec: FieldSpec): number {
  if (spec.dataType === "Long text") return 46;
  if (spec.dataType === "URL" || spec.dataType === "URL/Text") return 42;
  if (spec.dataType === "Date" || spec.dataType === "Time" || spec.dataType === "Date/Text") return 14;
  if (spec.dataType === "Boolean" || spec.dataType === "Integer" || spec.dataType === "Decimal") return 12;
  if (spec.list) return 30;
  return 22;
}

/** Rows of one sheet for one temple, as plain records addressed by FieldSpec.path. */
function rowsFor(temple: Temple, sheet: SheetId): unknown[] {
  if (sheet === "01_Temple_Master") return [temple];
  if (sheet === "02_Visiting_Info") return [temple.visitingInfo];
  const collection = SHEET_COLLECTION[sheet];
  if (!collection) return [];
  return temple[collection] as unknown[];
}

function addDataSheet(workbook: ExcelJS.Workbook, sheetId: SheetId, temples: Temple[]): void {
  const sheet = workbook.addWorksheet(sheetId);
  const specs = specsForSheet(sheetId);

  sheet.columns = specs.map((spec) => ({ header: spec.column, key: spec.column, width: widthFor(spec) }));
  styleHeader(sheet, specs.length);

  for (const temple of temples) {
    for (const record of rowsFor(temple, sheetId)) {
      const values: Record<string, unknown> = {};
      for (const spec of specs) {
        if (spec.path === null) {
          values[spec.column] = temple.templeId;
          continue;
        }
        // Sheet 01 addresses the temple itself; child sheets address one record.
        const source = sheetId === "01_Temple_Master" ? temple : record;
        values[spec.column] = writeCell(spec, getPath(source, spec.path));
      }
      sheet.addRow(values);
    }
  }

  // Dropdowns for every enumerated column, so contributors pick rather than type.
  specs.forEach((spec, index) => {
    if (!spec.lookup) return;
    const values = LOOKUPS[spec.lookup];
    if (!values?.length) return;
    const column = sheet.getColumn(index + 1);
    for (let rowNumber = 2; rowNumber <= Math.max(sheet.rowCount, 200); rowNumber += 1) {
      sheet.getCell(rowNumber, column.number).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${values.join(",")}"`],
        showErrorMessage: false,
      };
    }
  });
}

function addReadme(workbook: ExcelJS.Workbook, templeCount: number): void {
  const sheet = workbook.addWorksheet("README");
  sheet.columns = [{ width: 30 }, { width: 110 }];
  const rows: [string, string][] = [
    ["TEMPLE DIRECTORY", "Input schema & contributor feed template"],
    ["", ""],
    ["Contents", `${templeCount} temple${templeCount === 1 ? "" : "s"} across 9 linked sheets.`],
    [
      "Design principle",
      "One row per temple for core identity. Everything repeatable — hours, SOP steps, shrines, poojas, festivals, media, sources — is its own sheet, linked by temple_id.",
    ],
    [
      "Why not one wide sheet",
      "Repeatable entities flattened into Festival_1/Festival_2/Image_1 columns become unmaintainable and cannot carry their own sources.",
    ],
    [
      "Publication rule",
      "A spiritual instruction does not become public merely because a contributor typed it. Every record carries source_ids and verification_status; unverified shrine order, pradakshina counts and mantras stay in editorial review.",
    ],
    ["", ""],
    ["Import order", "1. Sources  2. Temple Master  3. Visiting Info  4. Opening Hours  5. Media  6. Worship SOP  7. Shrines / Route  8. Poojas / Sevas  9. Festivals"],
    ["", ""],
    ["Editing notes", "Do not rename sheets or header rows — the importer matches on them."],
    ["", "Multi-value cells (source_ids, linked_media_ids, alternate_names) are separated with a semicolon."],
    ["", "Dates are YYYY-MM-DD. Times are 24-hour HH:MM."],
    ["", "Cell comments and Excel tables are ignored on import; they will not break the upload."],
    ["10_Column_Dictionary", "Every column, its data type, whether it is required, and which page section it feeds."],
    ["11_Lookups", "Allowed values for each dropdown column."],
  ];
  rows.forEach(([label, value]) => {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  });
  sheet.getRow(1).font = { bold: true, size: 14 };
}

function addDictionary(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet("10_Column_Dictionary");
  sheet.columns = [
    { header: "sheet", width: 24 },
    { header: "column", width: 28 },
    { header: "data_type", width: 12 },
    { header: "requirement", width: 14 },
    { header: "repeatable", width: 12 },
    { header: "description", width: 62 },
    { header: "source_required", width: 16 },
    { header: "public_section", width: 28 },
  ];
  styleHeader(sheet, 8);
  for (const spec of FIELD_SPECS) {
    sheet.addRow([
      spec.sheet,
      spec.column,
      spec.dataType,
      spec.requirement,
      spec.repeatable ? "Yes" : "No",
      spec.description,
      spec.sourceRequired,
      spec.publicSection,
    ]);
  }
}

/**
 * The nine data sheets are the schema's contract, so anything the product
 * carries that the schema has no column for — the nearby list,
 * reviews, the prose sections with no home — travels in one JSON column here.
 * Without it an export/import cycle would quietly drop those fields.
 */
function addExtensions(workbook: ExcelJS.Workbook, temples: Temple[]): void {
  const sheet = workbook.addWorksheet("12_Extensions");
  sheet.columns = [
    { header: "temple_id", key: "temple_id", width: 24 },
    { header: "temple_slug", key: "temple_slug", width: 32 },
    { header: "extensions_json", key: "extensions_json", width: 120 },
  ];
  styleHeader(sheet, 3);
  for (const temple of temples) {
    sheet.addRow({
      temple_id: temple.templeId,
      temple_slug: temple.slug,
      extensions_json: JSON.stringify(temple.extensions),
    });
  }
  sheet.getColumn(3).alignment = { wrapText: false };
}

function addLookups(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet("11_Lookups");
  const names = Object.keys(LOOKUPS);
  sheet.columns = names.map((name) => ({ header: name, width: 26 }));
  styleHeader(sheet, names.length);
  const depth = Math.max(...names.map((n) => LOOKUPS[n].length), 0);
  for (let i = 0; i < depth; i += 1) {
    sheet.addRow(names.map((name) => LOOKUPS[name][i] ?? null));
  }
}

export function buildTempleWorkbook(temples: Temple[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Temple Directory";
  workbook.created = new Date();

  addReadme(workbook, temples.length);
  for (const sheetId of SHEET_ORDER) addDataSheet(workbook, sheetId, temples);
  addDictionary(workbook);
  addLookups(workbook);
  addExtensions(workbook, temples);

  return workbook;
}
