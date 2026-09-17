import type { DataType, FieldSpec } from "../schema";
import { LOOKUPS } from "../schema";

/**
 * Cell coercion, both directions.
 *
 * Excel hands back Dates for date AND time cells, numbers for anything
 * numeric-looking, and rich-text objects for styled cells, so every read goes
 * through here rather than through `cell.text` — which would return a
 * locale-formatted string and quietly corrupt times.
 */

export type RawCell = unknown;

const TRUE_WORDS = new Set(["true", "yes", "y", "1"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0"]);

function cellText(value: RawCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // exceljs shapes: { text }, { richText: [...] }, { result }, { hyperlink, text }
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => String((r as { text?: string }).text ?? "")).join("");
    }
    if (obj.result !== undefined) return cellText(obj.result);
    if (typeof obj.hyperlink === "string") return obj.hyperlink;
  }
  return String(value);
}

/** Excel dates arrive as UTC-midnight Dates; take the calendar date, not the local one. */
function toIsoDate(value: RawCell): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = cellText(value).trim();
  if (!text) return undefined;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return text; // free text like "c. 12th century" — Date/Text columns allow it
}

/** Normalizes 6:30 AM / 18:30 / an Excel time serial to 24h "HH:mm". */
function toClockTime(value: RawCell): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date) {
    const h = String(value.getUTCHours()).padStart(2, "0");
    const m = String(value.getUTCMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  if (typeof value === "number" && value >= 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60);
    const h = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  }
  const text = cellText(value).trim();
  if (!text) return undefined;
  const match = text.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
  if (match) {
    let hour = Number(match[1]);
    const minute = match[2];
    const meridiem = match[3]?.toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }
  return text;
}

function toNumber(value: RawCell): number | undefined {
  if (typeof value === "number") return value;
  const text = cellText(value).trim();
  if (!text) return undefined;
  const n = Number(text.replace(/[^\d.\-+eE]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function toBoolean(value: RawCell): boolean | undefined {
  if (typeof value === "boolean") return value;
  const text = cellText(value).trim().toLowerCase();
  if (!text) return undefined;
  if (TRUE_WORDS.has(text)) return true;
  if (FALSE_WORDS.has(text)) return false;
  return undefined;
}

/** Semicolon is the documented separator; commas are accepted because people use them. */
export function splitList(value: RawCell): string[] {
  const text = cellText(value).trim();
  if (!text) return [];
  return text
    .split(/[;\n]+/)
    .flatMap((part) => (part.includes(",") && !part.includes(" · ") ? part.split(",") : [part]))
    .map((part) => part.trim())
    .filter(Boolean);
}

export interface CellIssue {
  column: string;
  message: string;
  level: "error" | "warning";
}

/**
 * Reads one cell according to its FieldSpec. Unknown lookup values are a
 * warning and pass through unchanged — a contributor's slightly-off vocabulary
 * should not block an import, but it should be visible.
 */
export function readCell(
  spec: FieldSpec,
  value: RawCell
): { value: unknown; issues: CellIssue[] } {
  const issues: CellIssue[] = [];

  if (spec.list) return { value: splitList(value), issues };

  switch (spec.dataType as DataType) {
    case "Boolean": {
      const parsed = toBoolean(value);
      if (parsed === undefined && cellText(value).trim()) {
        issues.push({
          column: spec.column,
          level: "warning",
          message: `expected TRUE/FALSE, got "${cellText(value)}"`,
        });
      }
      return { value: parsed, issues };
    }
    case "Integer": {
      const n = toNumber(value);
      return { value: n === undefined ? undefined : Math.round(n), issues };
    }
    case "Decimal":
      return { value: toNumber(value), issues };
    case "Date":
    case "Date/Text":
      return { value: toIsoDate(value), issues };
    case "Time":
      return { value: toClockTime(value), issues };
    case "Lookup": {
      const text = cellText(value).trim();
      if (!text) return { value: undefined, issues };
      const allowed = spec.lookup ? LOOKUPS[spec.lookup] : undefined;
      if (allowed) {
        const match = allowed.find((v) => v.toLowerCase() === text.toLowerCase());
        if (match) return { value: match, issues };
        issues.push({
          column: spec.column,
          level: "warning",
          message: `"${text}" is not one of: ${allowed.join(", ")}`,
        });
      }
      return { value: text, issues };
    }
    default: {
      const text = cellText(value);
      const trimmed = spec.dataType === "Long text" ? text.replace(/\s+$/, "") : text.trim();
      return { value: trimmed || undefined, issues };
    }
  }
}

/** Formats a value for writing back into a cell. */
export function writeCell(spec: FieldSpec, value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (spec.list) return Array.isArray(value) ? value.join("; ") : String(value);
  if (spec.dataType === "Boolean") return value === true ? "TRUE" : "FALSE";
  if (spec.dataType === "Integer" || spec.dataType === "Decimal") {
    return typeof value === "number" ? value : Number(value);
  }
  return String(value);
}
