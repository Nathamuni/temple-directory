import { createHash } from "crypto";
import type { Temple } from "../types";
import type { GrantRole } from "../roles";
import {
  canonical,
  changedAreas,
  forbiddenAreas,
  stampAuthority,
  vouchableAreas,
  type Area,
  AREA_LABEL,
} from "../fieldAuthority";
import { getTemple, replacePublishedTemple } from "../temples";
import { audit } from "./audit";
import { newId, readJson, updateJson } from "./jsonStore";

/**
 * A proposed change to a temple that is already live.
 *
 * The public page keeps showing the current version until an admin approves
 * the revision. `baseHash` pins what the proposer was looking at: if the temple
 * changed underneath (another revision approved, an import), approval stops and
 * the revision is marked `conflict` instead of silently overwriting that work.
 */
export type RevisionStatus = "pending" | "approved" | "rejected" | "conflict";

export interface Revision {
  id: string;
  templeSlug: string;
  baseHash: string;
  proposed: Temple;
  changedAreas: Area[];
  /** Areas the role holder confirmed as current without necessarily changing them. */
  confirmedAreas: Area[];
  actingRole: GrantRole;
  submittedBy: string;
  note?: string;
  createdAt: string;
  status: RevisionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reason?: string;
}

const FILE = "revisions.json";

/** Fields a revision may never set: identity of the entry and its editorial state. */
const PROTECTED = ["slug", "templeId", "status", "submittedBy", "rejectionReason"] as const;

export function templeHash(temple: Temple): string {
  const { status: _s, rejectionReason: _r, ...rest } = temple;
  return createHash("sha256").update(JSON.stringify(canonical(rest))).digest("hex").slice(0, 16);
}

export function listRevisions(): Revision[] {
  return readJson<Revision[]>(FILE, []);
}

export function getRevision(id: string): Revision | undefined {
  return listRevisions().find((r) => r.id === id);
}

export function pendingRevisionCount(): number {
  return listRevisions().filter((r) => r.status === "pending").length;
}

export class RevisionError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 = 400) {
    super(message);
  }
}

export function proposeRevision(input: {
  templeSlug: string;
  proposed: Temple;
  actingRole: GrantRole;
  submittedBy: string;
  confirmedAreas?: Area[];
  note?: string;
}): Revision {
  const current = getTemple(input.templeSlug);
  if (!current) throw new RevisionError("Temple not found.", 404);
  if (current.status !== "published") {
    throw new RevisionError("Only published temples take revisions; drafts are edited directly.", 409);
  }

  // Whatever the payload claims, the entry's identity and editorial state stay put.
  const proposed: Temple = { ...input.proposed, editorial: current.editorial };
  for (const key of PROTECTED) (proposed as unknown as Record<string, unknown>)[key] = current[key];

  const changed = changedAreas(current, proposed);
  const confirmed = vouchableAreas(input.actingRole, input.confirmedAreas ?? []);
  if (changed.length === 0 && confirmed.length === 0) {
    throw new RevisionError("Nothing changed — edit a field or confirm a section as current.");
  }
  const forbidden = forbiddenAreas(input.actingRole, [...changed, ...confirmed]);
  if (forbidden.length > 0) {
    throw new RevisionError(
      `Your role cannot change: ${forbidden.map((a) => AREA_LABEL[a]).join(", ")}.`,
      403
    );
  }
  const duplicate = listRevisions().find(
    (r) => r.templeSlug === input.templeSlug && r.submittedBy === input.submittedBy && r.status === "pending"
  );
  if (duplicate) {
    throw new RevisionError("You already have a change waiting for review on this temple.", 409);
  }

  const revision: Revision = {
    id: newId("rev"),
    templeSlug: input.templeSlug,
    baseHash: templeHash(current),
    proposed,
    changedAreas: changed,
    confirmedAreas: confirmed,
    actingRole: input.actingRole,
    submittedBy: input.submittedBy,
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  updateJson<Revision[]>(FILE, [], (all) => [...all, revision]);
  return revision;
}

function setStatus(id: string, patch: Partial<Revision>): Revision {
  let changed: Revision | undefined;
  updateJson<Revision[]>(FILE, [], (all) =>
    all.map((r) => {
      if (r.id !== id) return r;
      changed = { ...r, ...patch };
      return changed;
    })
  );
  return changed!;
}

export function reviewRevision(
  id: string,
  decision: "approved" | "rejected",
  actor: string,
  reason?: string
): Revision {
  const revision = getRevision(id);
  if (!revision) throw new RevisionError("No such revision.", 404);
  if (revision.status !== "pending") throw new RevisionError(`This revision was already ${revision.status}.`, 409);
  const reviewed = { reviewedBy: actor, reviewedAt: new Date().toISOString() };

  if (decision === "rejected") {
    if (!reason?.trim()) throw new RevisionError("A reason is required to reject a revision.");
    const done = setStatus(id, { ...reviewed, status: "rejected", reason: reason.trim() });
    audit({ actor, action: "revision.rejected", target: `${revision.templeSlug}/${id}`, detail: reason });
    return done;
  }

  const current = getTemple(revision.templeSlug);
  if (!current || templeHash(current) !== revision.baseHash) {
    const done = setStatus(id, {
      ...reviewed,
      status: "conflict",
      reason: "The temple changed after this revision was proposed. Ask the proposer to start again from the current version.",
    });
    audit({ actor, action: "revision.conflict", target: `${revision.templeSlug}/${id}` });
    return done;
  }

  const today = reviewed.reviewedAt.slice(0, 10);
  const vouched = [...new Set([...revision.changedAreas, ...revision.confirmedAreas])];
  const approved = stampAuthority(revision.proposed, revision.actingRole, revision.submittedBy, today, vouched);
  replacePublishedTemple(approved);
  const done = setStatus(id, { ...reviewed, status: "approved" });
  audit({
    actor,
    action: "revision.approved",
    target: `${revision.templeSlug}/${id}`,
    detail: `${revision.actingRole} ${revision.submittedBy}: ${vouched.join(", ")}`,
  });
  return done;
}
