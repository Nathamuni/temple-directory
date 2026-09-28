import { audit } from "./audit";
import { newId, readJson, updateJson } from "./jsonStore";

/**
 * A devotee's correction or current observation about a published temple.
 * Free text, so it is never merged automatically: an admin reads it, fixes the
 * entry (or asks a contributor / the temple to), and marks it resolved.
 */
export type CorrectionKind = "correction" | "observation";
export type CorrectionStatus = "pending" | "resolved" | "dismissed";

export interface Correction {
  id: string;
  templeSlug: string;
  kind: CorrectionKind;
  section: string;
  message: string;
  sourceUrl?: string;
  submittedBy: string;
  submittedAt: string;
  status: CorrectionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  response?: string;
}

const FILE = "corrections.json";

export const CORRECTION_SECTIONS = [
  "Opening hours",
  "Entry rules / dress code",
  "Pooja & seva",
  "Festivals",
  "How to worship",
  "Mantra / sloka",
  "History & significance",
  "Location / contact",
  "Photos",
  "Something else",
];

export function listCorrections(): Correction[] {
  return readJson<Correction[]>(FILE, []);
}

export function pendingCorrectionCount(): number {
  return listCorrections().filter((c) => c.status === "pending").length;
}

export function submitCorrection(input: Omit<Correction, "id" | "submittedAt" | "status">): Correction {
  if (input.message.trim().length < 10) throw new Error("Please describe the correction in a sentence or two.");
  const correction: Correction = {
    ...input,
    message: input.message.trim(),
    id: newId("cor"),
    submittedAt: new Date().toISOString(),
    status: "pending",
  };
  updateJson<Correction[]>(FILE, [], (all) => [...all, correction]);
  return correction;
}

export function reviewCorrection(id: string, status: "resolved" | "dismissed", actor: string, response?: string): Correction {
  if (status === "dismissed" && !response?.trim()) throw new Error("A reason is required to dismiss a correction.");
  let changed: Correction | undefined;
  updateJson<Correction[]>(FILE, [], (all) =>
    all.map((c) => {
      if (c.id !== id) return c;
      if (c.status !== "pending") throw new Error(`This correction was already ${c.status}.`);
      changed = { ...c, status, reviewedBy: actor, reviewedAt: new Date().toISOString(), response: response?.trim() || undefined };
      return changed;
    })
  );
  if (!changed) throw new Error("No such correction.");
  audit({ actor, action: `correction.${status}`, target: `${changed.templeSlug}/${id}`, detail: response });
  return changed;
}
