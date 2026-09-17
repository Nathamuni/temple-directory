import type { SheetIssue } from "./excel/parse";

/**
 * A bulk-import result, held just long enough to render it on the next page
 * load. A nine-sheet workbook can produce far more issues than fit in a query
 * string, which is how they used to be passed (truncated at ten).
 *
 * In-memory and single-process, matching the JSON-file store this app already
 * uses; a report that is lost on restart is not worth persisting.
 */
export interface ImportReport {
  id: string;
  createdAt: number;
  fileName: string;
  created: { slug: string; name: string }[];
  updated: { slug: string; name: string; unpublished: boolean }[];
  /** Rows that matched an existing temple but changed nothing. */
  unchanged: number;
  skipped: { name: string; reason: string }[];
  issues: SheetIssue[];
}

const REPORTS = new Map<string, ImportReport>();
const MAX_REPORTS = 20;
const TTL_MS = 30 * 60 * 1000;

export function saveImportReport(report: Omit<ImportReport, "id" | "createdAt">): string {
  const id = Math.random().toString(36).slice(2, 10);
  REPORTS.set(id, { ...report, id, createdAt: Date.now() });

  for (const [key, value] of REPORTS) {
    if (Date.now() - value.createdAt > TTL_MS) REPORTS.delete(key);
  }
  while (REPORTS.size > MAX_REPORTS) {
    const oldest = [...REPORTS.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (!oldest) break;
    REPORTS.delete(oldest[0]);
  }
  return id;
}

export function getImportReport(id: string | undefined): ImportReport | undefined {
  return id ? REPORTS.get(id) : undefined;
}
