/**
 * The one place that decides whether a temple record is complete enough.
 *
 * Everything here is derived from FIELD_SPECS (generated from the workbook's
 * Column Dictionary) plus a short list of cross-field rules, so the contributor
 * form, the Excel importer and the publish gate cannot disagree about what a
 * temple needs — which they previously did, in three separate hard-coded lists.
 */
import type { Temple } from "./types";
import { PUBLISHABLE_VERIFICATION } from "./types";
import type { FieldSpec, SheetId } from "./schema";
import { FIELD_SPECS, SHEET_COLLECTION } from "./schema";
import { getPath } from "./paths";

export type IssueLevel = "error" | "warning";

export interface ValidationIssue {
  level: IssueLevel;
  sheet: SheetId | "(cross-field)";
  column: string;
  /** Full path into the Temple, including the record index for child sheets. */
  path: string;
  /** Which page section this blocks, from the Column Dictionary. */
  section: string;
  message: string;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Records on a child sheet, paired with the path prefix that addresses them. */
function recordsFor(temple: Temple, sheet: SheetId): { record: unknown; prefix: string }[] {
  const collection = SHEET_COLLECTION[sheet];
  if (sheet === "01_Temple_Master") return [{ record: temple, prefix: "" }];
  if (!collection) return [];
  if (sheet === "02_Visiting_Info") return [{ record: temple.visitingInfo, prefix: "visitingInfo." }];
  const array = temple[collection] as unknown[];
  return array.map((record, index) => ({ record, prefix: `${collection}[${index}].` }));
}

function issueFor(spec: FieldSpec, prefix: string, level: IssueLevel, message: string): ValidationIssue {
  return {
    level,
    sheet: spec.sheet,
    column: spec.column,
    path: `${prefix}${spec.path}`,
    section: spec.publicSection,
    message,
  };
}

/**
 * Required columns become errors, Recommended ones warnings. Optional columns
 * are never reported. A child sheet with no rows at all is not an error here —
 * "no festivals recorded" is a completeness question, not a validity one.
 */
export function validateTemple(temple: Temple): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const sheets = [...new Set(FIELD_SPECS.map((s) => s.sheet))];
  for (const sheet of sheets) {
    const specs = FIELD_SPECS.filter((s) => s.sheet === sheet && s.path !== null);
    for (const { record, prefix } of recordsFor(temple, sheet)) {
      for (const spec of specs) {
        if (spec.requirement === "Optional") continue;
        const value = getPath(record, spec.path!);
        if (!isEmpty(value)) continue;
        issues.push(
          issueFor(
            spec,
            prefix,
            spec.requirement === "Required" ? "error" : "warning",
            `${spec.column} is ${spec.requirement.toLowerCase()} but empty`
          )
        );
      }
    }
  }

  issues.push(...crossFieldIssues(temple));
  return issues;
}

/** Rules that no single column can express. */
function crossFieldIssues(temple: Temple): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (level: IssueLevel, path: string, section: string, message: string) =>
    issues.push({ level, sheet: "(cross-field)", column: "", path, section, message });

  const approvedSources = temple.sources.filter((s) => s.adminApproved);
  if (approvedSources.length < 2) {
    add(
      "error",
      "sources",
      "References",
      `at least 2 admin-approved sources are required (found ${approvedSources.length})`
    );
  }

  const heroes = temple.media.filter((m) => m.category === "hero" && m.editorialApproved);
  if (heroes.length === 0) {
    add("error", "media", "Hero / gallery / inline", "no editorially-approved hero image");
  }

  if (temple.worshipSop.length > 0) {
    const numbers = temple.worshipSop.map((s) => s.stepNumber);
    if (new Set(numbers).size !== numbers.length) {
      add("error", "worshipSop", "How to worship", "SOP step numbers must be unique");
    }
    if (numbers.some((n) => n < 1 || n > 6)) {
      add("error", "worshipSop", "How to worship", "SOP step numbers must be between 1 and 6");
    }
  }

  // A spiritual instruction is only publishable with an authority behind it.
  temple.worshipSop.forEach((step, index) => {
    const sensitive = step.mantraOrSloka;
    if (sensitive && step.verificationStatus !== "authority-verified") {
      add(
        "warning",
        `worshipSop[${index}].mantraOrSloka`,
        "How to worship",
        `step ${step.stepNumber} carries a mantra but is "${step.verificationStatus}" — it will not be shown publicly`
      );
    }
  });
  temple.shrines.forEach((shrine, index) => {
    const ordered = shrine.sequenceNumber !== undefined || shrine.pradakshinaCount !== undefined;
    if (ordered && shrine.verificationStatus !== "authority-verified") {
      add(
        "warning",
        `shrines[${index}]`,
        "Temple layout / worship route",
        `"${shrine.shrineName}" has a worship order or pradakshina count but is "${shrine.verificationStatus}" — the order will not be shown publicly`
      );
    }
  });

  const { latitude, longitude } = temple.location;
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    add("error", "location.latitude", "Identity / History", `latitude ${latitude} is out of range`);
  }
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    add("error", "location.longitude", "Identity / History", `longitude ${longitude} is out of range`);
  }

  return issues;
}

/** Only a fully valid entry may be marked verified or published. */
export function canPublish(temple: Temple): { ok: boolean; blockers: ValidationIssue[] } {
  const blockers = validateTemple(temple).filter((i) => i.level === "error");
  return { ok: blockers.length === 0, blockers };
}

export interface Completeness {
  pct: number;
  /** 0–100 per public section, in Column Dictionary order. */
  bySection: { section: string; pct: number; missing: number }[];
  missing: ValidationIssue[];
}

/**
 * How much of the schema this entry actually fills in. Required and
 * recommended columns both count — a page section with only its mandatory
 * fields is thin, and the Data confidence card should say so.
 */
export function completeness(temple: Temple): Completeness {
  const issues = validateTemple(temple).filter((i) => i.sheet !== "(cross-field)");
  const counted = FIELD_SPECS.filter((s) => s.path !== null && s.requirement !== "Optional");

  const sections = [...new Set(counted.map((s) => s.publicSection))];
  const bySection = sections.map((section) => {
    const specs = counted.filter((s) => s.publicSection === section);

    // Each field is counted once per record on its sheet. A repeatable sheet
    // with no rows at all counts its fields once and scores them all missing —
    // otherwise "no festivals recorded" would report as 100% complete, which
    // is the opposite of what a readiness panel is for.
    let total = 0;
    let missing = issues.filter((i) => i.section === section).length;
    for (const spec of specs) {
      const rows = recordsFor(temple, spec.sheet).length;
      if (rows === 0) {
        total += 1;
        missing += 1;
      } else {
        total += rows;
      }
    }

    const pct = total === 0 ? 0 : Math.round(((total - missing) / total) * 100);
    return { section, pct: Math.max(0, Math.min(100, pct)), missing };
  });

  const overall =
    bySection.length === 0
      ? 0
      : Math.round(bySection.reduce((sum, s) => sum + s.pct, 0) / bySection.length);

  return { pct: overall, bySection, missing: issues };
}

/** True when a record's provenance permits stating it publicly as fact. */
export function isPublishableRecord(record: { verificationStatus: string }): boolean {
  return PUBLISHABLE_VERIFICATION.includes(record.verificationStatus as never);
}
