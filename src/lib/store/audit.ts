import { appendLine, readLines } from "./jsonStore";

/** One line per decision an admin or role holder makes. Never rewritten. */
export interface AuditEntry {
  at: string;
  /** Username of whoever acted. */
  actor: string;
  action: string;
  /** What was acted on: a username, grant id, temple slug, revision id… */
  target: string;
  detail?: string;
}

const FILE = "audit.jsonl";

export function audit(entry: Omit<AuditEntry, "at">): void {
  appendLine(FILE, { at: new Date().toISOString(), ...entry });
}

/** Newest first. */
export function readAudit(limit = 200): AuditEntry[] {
  return readLines<AuditEntry>(FILE).reverse().slice(0, limit);
}
