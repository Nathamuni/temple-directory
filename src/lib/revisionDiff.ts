import type { Temple } from "./types";
import { canonical, type Area } from "./fieldAuthority";

/**
 * A readable, field-level account of what a revision changes, for the admin
 * reviewing it. Records in repeatable areas are matched by their `...Id` key.
 */
export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

function show(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(show).join("; ") : "—";
  if (typeof value === "object") return JSON.stringify(canonical(value));
  return String(value);
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function objectChanges(before: Record<string, unknown>, after: Record<string, unknown>, prefix = ""): FieldChange[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  return keys
    .filter((k) => !same(before?.[k], after?.[k]))
    .map((k) => ({ label: `${prefix}${k}`, before: show(before?.[k]), after: show(after?.[k]) }));
}

function idOf(row: Record<string, unknown>): string {
  const key = Object.keys(row).find((k) => k.endsWith("Id") && typeof row[k] === "string");
  return key ? String(row[key]) : JSON.stringify(canonical(row));
}

function rowName(row: Record<string, unknown>): string {
  for (const k of ["nameEn", "festivalNameEn", "stepTitle", "shrineName", "sessionName", "title"]) {
    if (typeof row[k] === "string" && row[k]) return `${idOf(row)} “${row[k]}”`;
  }
  return idOf(row);
}

function arrayChanges(before: Record<string, unknown>[], after: Record<string, unknown>[]): FieldChange[] {
  const out: FieldChange[] = [];
  const beforeById = new Map(before.map((r) => [idOf(r), r]));
  const afterById = new Map(after.map((r) => [idOf(r), r]));
  for (const [id, row] of afterById) {
    const old = beforeById.get(id);
    if (!old) out.push({ label: `+ ${rowName(row)}`, before: "—", after: "added" });
    else out.push(...objectChanges(old, row, `${rowName(row)} · `));
  }
  for (const [id, row] of beforeById) {
    if (!afterById.has(id)) out.push({ label: `− ${rowName(row)}`, before: "present", after: "removed" });
  }
  return out;
}

export function describeChanges(before: Temple, after: Temple, areas: Area[]): { area: Area; changes: FieldChange[] }[] {
  return areas.map((area) => {
    if (area === "identity.sampradayaAgama") {
      return { area, changes: [{ label: "sampradayaAgama", before: show(before.identity.sampradayaAgama), after: show(after.identity.sampradayaAgama) }] };
    }
    if (area === "identity") {
      const { sampradayaAgama: _a, ...b } = before.identity;
      const { sampradayaAgama: _b, ...a } = after.identity;
      return { area, changes: objectChanges(b, a) };
    }
    const b = before[area] as unknown;
    const a = after[area] as unknown;
    if (Array.isArray(b) || Array.isArray(a)) {
      return { area, changes: arrayChanges((b ?? []) as Record<string, unknown>[], (a ?? []) as Record<string, unknown>[]) };
    }
    return { area, changes: objectChanges((b ?? {}) as Record<string, unknown>, (a ?? {}) as Record<string, unknown>) };
  });
}
