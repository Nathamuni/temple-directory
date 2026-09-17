import type ExcelJS from "exceljs";
import type { Temple } from "../types";
import type { FieldSpec, SheetId } from "../schema";
import { SHEET_COLLECTION, specsForSheet } from "../schema";
import { blankTemple, blankVisitingInfo } from "../blankTemple";
import { setPath } from "../paths";
import { readCell } from "./cells";
import { readWorkbook, type WorkbookInput } from "./workbook";

export interface SheetIssue {
  sheet: string;
  /** 1-based worksheet row; 0 for whole-sheet problems. */
  row: number;
  column?: string;
  level: "error" | "warning";
  message: string;
}

export interface ParseResult {
  temples: Temple[];
  issues: SheetIssue[];
}

/**
 * Child sheets are read in dependency order so that a record's source_ids and
 * linked_media_ids can be checked against rows that already exist.
 */
const CHILD_SHEETS: SheetId[] = [
  "09_Sources",
  "08_Media",
  "05_Shrines_Route",
  "02_Visiting_Info",
  "03_Opening_Hours",
  "04_Worship_SOP",
  "06_Pooja_Seva",
  "07_Festivals",
];

function headerMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const name = String(cell.text ?? "").trim();
    if (name) map.set(name, col);
  });
  return map;
}

function rowIsBlank(row: ExcelJS.Row, columns: number[]): boolean {
  return columns.every((col) => {
    const value = row.getCell(col).value;
    return value === null || value === undefined || String(value).trim() === "";
  });
}

/** Reads one worksheet row into a plain record using that sheet's specs. */
function readRecord(
  sheetId: SheetId,
  specs: FieldSpec[],
  headers: Map<string, number>,
  row: ExcelJS.Row,
  rowNumber: number,
  issues: SheetIssue[]
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const spec of specs) {
    if (spec.path === null) continue;
    const col = headers.get(spec.column);
    if (col === undefined) continue;
    const { value, issues: cellIssues } = readCell(spec, row.getCell(col).value);
    for (const issue of cellIssues) {
      issues.push({ sheet: sheetId, row: rowNumber, column: issue.column, level: issue.level, message: issue.message });
    }
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    setPath(record, spec.path, value);
  }
  return record;
}

/** Reads the temple_id join key from a row, if the sheet has one. */
function templeIdOf(headers: Map<string, number>, row: ExcelJS.Row): string {
  const col = headers.get("temple_id");
  if (col === undefined) return "";
  return String(row.getCell(col).text ?? "").trim();
}

export async function parseTempleWorkbook(buffer: WorkbookInput): Promise<ParseResult> {
  const issues: SheetIssue[] = [];
  let workbook: ExcelJS.Workbook;
  try {
    workbook = await readWorkbook(buffer);
  } catch (error) {
    return {
      temples: [],
      issues: [
        {
          sheet: "(workbook)",
          row: 0,
          level: "error",
          message: `could not read this file as an .xlsx workbook — ${(error as Error).message}`,
        },
      ],
    };
  }

  const master = workbook.getWorksheet("01_Temple_Master");
  if (!master) {
    return {
      temples: [],
      issues: [
        {
          sheet: "01_Temple_Master",
          row: 0,
          level: "error",
          message: "sheet is missing — download a fresh template and copy your data into it",
        },
      ],
    };
  }

  /* ---- 01_Temple_Master ---- */
  const masterSpecs = specsForSheet("01_Temple_Master");
  const masterHeaders = headerMap(master);
  const dataColumns = [...masterHeaders.values()];
  const byId = new Map<string, Temple>();

  for (let rowNumber = 2; rowNumber <= master.rowCount; rowNumber += 1) {
    const row = master.getRow(rowNumber);
    if (rowIsBlank(row, dataColumns)) continue;

    const record = readRecord("01_Temple_Master", masterSpecs, masterHeaders, row, rowNumber, issues);
    const temple = blankTemple();
    Object.assign(temple, mergeDeep(temple as unknown as Record<string, unknown>, record));

    if (!temple.templeId) {
      issues.push({
        sheet: "01_Temple_Master",
        row: rowNumber,
        column: "temple_id",
        level: "error",
        message: "temple_id is required — every other sheet joins on it",
      });
      continue;
    }
    if (byId.has(temple.templeId)) {
      issues.push({
        sheet: "01_Temple_Master",
        row: rowNumber,
        column: "temple_id",
        level: "error",
        message: `duplicate temple_id "${temple.templeId}"`,
      });
      continue;
    }
    byId.set(temple.templeId, temple);
  }

  /* ---- child sheets ---- */
  for (const sheetId of CHILD_SHEETS) {
    const sheet = workbook.getWorksheet(sheetId);
    if (!sheet) continue;
    const specs = specsForSheet(sheetId);
    const headers = headerMap(sheet);
    const columns = [...headers.values()];
    const collection = SHEET_COLLECTION[sheetId];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (rowIsBlank(row, columns)) continue;

      const templeId = templeIdOf(headers, row);
      if (!templeId) {
        issues.push({ sheet: sheetId, row: rowNumber, column: "temple_id", level: "error", message: "temple_id is blank" });
        continue;
      }
      const temple = byId.get(templeId);
      if (!temple) {
        issues.push({
          sheet: sheetId,
          row: rowNumber,
          column: "temple_id",
          level: "error",
          message: `temple_id "${templeId}" does not appear in 01_Temple_Master`,
        });
        continue;
      }

      const record = readRecord(sheetId, specs, headers, row, rowNumber, issues);

      if (sheetId === "02_Visiting_Info") {
        temple.visitingInfo = { ...blankVisitingInfo(), ...(record as object) } as Temple["visitingInfo"];
        continue;
      }
      if (!collection) continue;
      const withDefaults = withRecordDefaults(sheetId, record);
      (temple[collection] as unknown[]).push(withDefaults);
    }
  }

  readExtensions(workbook, byId, issues);

  const temples = [...byId.values()];
  for (const temple of temples) {
    issues.push(...checkCrossLinks(temple));
  }

  return { temples, issues };
}

/**
 * Restores the product-only fields the nine schema sheets cannot carry.
 * A missing or unreadable sheet is not fatal — a contributor workbook built
 * from the template may simply not have one.
 */
function readExtensions(
  workbook: ExcelJS.Workbook,
  byId: Map<string, Temple>,
  issues: SheetIssue[]
): void {
  const sheet = workbook.getWorksheet("12_Extensions");
  if (!sheet) return;
  const headers = headerMap(sheet);
  const idCol = headers.get("temple_id");
  const jsonCol = headers.get("extensions_json");
  if (!idCol || !jsonCol) return;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const templeId = String(row.getCell(idCol).text ?? "").trim();
    if (!templeId) continue;
    const temple = byId.get(templeId);
    if (!temple) continue;
    const raw = String(row.getCell(jsonCol).text ?? "").trim();
    if (!raw) continue;
    try {
      temple.extensions = { ...temple.extensions, ...(JSON.parse(raw) as Temple["extensions"]) };
    } catch {
      issues.push({
        sheet: "12_Extensions",
        row: rowNumber,
        column: "extensions_json",
        level: "warning",
        message: "could not be read as JSON — product-only fields for this temple were left at their defaults",
      });
    }
  }
}

/** Repeatable records always carry provenance and link arrays, even when the cells were blank. */
function withRecordDefaults(sheetId: SheetId, record: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = { ...record };
  if (sheetId !== "09_Sources" && sheetId !== "08_Media") {
    base.sourceIds = Array.isArray(base.sourceIds) ? base.sourceIds : [];
    base.verificationStatus = base.verificationStatus ?? "unverified";
  }
  if (sheetId === "04_Worship_SOP") {
    base.linkedShrineIds = Array.isArray(base.linkedShrineIds) ? base.linkedShrineIds : [];
  }
  if (["04_Worship_SOP", "05_Shrines_Route", "06_Pooja_Seva", "07_Festivals"].includes(sheetId)) {
    base.linkedMediaIds = Array.isArray(base.linkedMediaIds) ? base.linkedMediaIds : [];
  }
  if (sheetId === "03_Opening_Hours") base.closedFlag = base.closedFlag ?? false;
  if (sheetId === "08_Media") {
    base.editorialApproved = base.editorialApproved ?? false;
    base.verificationStatus = base.verificationStatus ?? "pending";
  }
  if (sheetId === "09_Sources") base.adminApproved = base.adminApproved ?? false;
  return base;
}

/**
 * A dangling source_id would render an empty citation chip, so unresolvable
 * links are dropped with a warning rather than carried into the page.
 */
function checkCrossLinks(temple: Temple): SheetIssue[] {
  const issues: SheetIssue[] = [];
  const sourceIds = new Set(temple.sources.map((s) => s.sourceId));
  const mediaIds = new Set(temple.media.map((m) => m.mediaId));
  const shrineIds = new Set(temple.shrines.map((s) => s.shrineId));

  const scrub = (
    sheet: SheetId,
    label: string,
    ids: string[] | undefined,
    known: Set<string>,
    column: string
  ): string[] => {
    if (!ids?.length) return [];
    const kept: string[] = [];
    for (const id of ids) {
      if (known.has(id)) kept.push(id);
      else
        issues.push({
          sheet,
          row: 0,
          column,
          level: "warning",
          message: `${label}: "${id}" does not exist in this temple — link dropped`,
        });
    }
    return kept;
  };

  const withProvenance: [SheetId, { sourceIds: string[] }[]][] = [
    ["03_Opening_Hours", temple.openingHours],
    ["04_Worship_SOP", temple.worshipSop],
    ["05_Shrines_Route", temple.shrines],
    ["06_Pooja_Seva", temple.poojas],
    ["07_Festivals", temple.festivals],
  ];
  for (const [sheet, records] of withProvenance) {
    for (const record of records) {
      record.sourceIds = scrub(sheet, "source_ids", record.sourceIds, sourceIds, "source_ids");
    }
  }
  temple.visitingInfo.sourceIds = scrub(
    "02_Visiting_Info",
    "source_ids",
    temple.visitingInfo.sourceIds,
    sourceIds,
    "source_ids"
  );

  for (const step of temple.worshipSop) {
    step.linkedMediaIds = scrub("04_Worship_SOP", "linked_media_ids", step.linkedMediaIds, mediaIds, "linked_media_ids");
    step.linkedShrineIds = scrub("04_Worship_SOP", "linked_shrine_ids", step.linkedShrineIds, shrineIds, "linked_shrine_ids");
  }
  for (const shrine of temple.shrines) {
    shrine.linkedMediaIds = scrub("05_Shrines_Route", "linked_media_ids", shrine.linkedMediaIds, mediaIds, "linked_media_ids");
  }
  for (const pooja of temple.poojas) {
    pooja.linkedMediaIds = scrub("06_Pooja_Seva", "linked_media_ids", pooja.linkedMediaIds, mediaIds, "linked_media_ids");
  }
  for (const festival of temple.festivals) {
    festival.linkedMediaIds = scrub("07_Festivals", "linked_media_ids", festival.linkedMediaIds, mediaIds, "linked_media_ids");
  }

  const heroes = temple.media.filter((m) => m.category === "hero");
  if (heroes.length > 1) {
    issues.push({
      sheet: "08_Media",
      row: 0,
      column: "category",
      level: "warning",
      message: `${heroes.length} rows are marked category "hero"; the first one is used`,
    });
  }

  return issues;
}

/** Shallow-merges parsed sections onto the blank temple without dropping defaults. */
function mergeDeep(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const existing = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      out[key] = mergeDeep(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}
