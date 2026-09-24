import type { Temple } from "./types";
import type { GrantRole } from "./roles";

/**
 * Who may change which part of a temple, and whose word makes it "verified".
 *
 * An *area* is a top-level part of the Temple object (one workbook sheet, or
 * one group of the master sheet). `identity.sampradayaAgama` is carved out of
 * identity because it is a ritual claim that belongs to the priest.
 *
 * Contributors may propose changes anywhere a researcher can cite a source,
 * but their word never makes a record "authority-verified". Temple management
 * and priests may only touch their own areas, and an admin-approved change
 * from them stamps those areas' records as authority-verified.
 */

export type Area =
  | "identity"
  | "identity.sampradayaAgama"
  | "location"
  | "governance"
  | "narrative"
  | "editorial"
  | "visitingInfo"
  | "openingHours"
  | "worshipSop"
  | "shrines"
  | "poojas"
  | "festivals"
  | "media"
  | "sources"
  | "extensions";

export const AREA_LABEL: Record<Area, string> = {
  identity: "Temple identity",
  "identity.sampradayaAgama": "Sampradaya / agama",
  location: "Location",
  governance: "Governance & contact",
  narrative: "History & significance",
  editorial: "Editorial status",
  visitingInfo: "Visiting information",
  openingHours: "Opening hours",
  worshipSop: "Worship SOP",
  shrines: "Shrines & route",
  poojas: "Pooja & seva",
  festivals: "Festivals",
  media: "Media",
  sources: "Sources",
  extensions: "Extensions",
};

/** Areas each role may change through a revision. */
export const EDITABLE_AREAS: Record<GrantRole, Area[]> = {
  contributor: [
    "identity",
    "identity.sampradayaAgama",
    "location",
    "governance",
    "narrative",
    "visitingInfo",
    "openingHours",
    "worshipSop",
    "shrines",
    "poojas",
    "festivals",
    "media",
    "sources",
  ],
  temple_management: ["governance", "visitingInfo", "openingHours", "poojas", "festivals", "media", "sources"],
  priest: ["identity.sampradayaAgama", "worshipSop", "shrines", "sources"],
  seva_coordinator: [],
};

/** Areas whose records an approved change from this role marks authority-verified. */
export const VOUCHED_AREAS: Partial<Record<GrantRole, Area[]>> = {
  temple_management: ["visitingInfo", "openingHours", "poojas", "festivals"],
  priest: ["worshipSop", "shrines"],
};

/** Roles that can propose a change to a published temple, most authoritative first. */
export const AUTHORITY_ROLES: GrantRole[] = ["temple_management", "priest"];

/** Canonical JSON: sorted keys, empty strings and undefined dropped. */
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const inner = (value as Record<string, unknown>)[key];
      if (inner === undefined || inner === "") continue;
      out[key] = canonical(inner);
    }
    return out;
  }
  return value;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

const TOP_LEVEL: Exclude<Area, "identity" | "identity.sampradayaAgama">[] = [
  "location",
  "governance",
  "narrative",
  "editorial",
  "visitingInfo",
  "openingHours",
  "worshipSop",
  "shrines",
  "poojas",
  "festivals",
  "media",
  "sources",
  "extensions",
];

/** Which areas differ between two versions of a temple. */
export function changedAreas(before: Temple, after: Temple): Area[] {
  const areas: Area[] = [];
  const { sampradayaAgama: beforeAgama, ...beforeIdentity } = before.identity;
  const { sampradayaAgama: afterAgama, ...afterIdentity } = after.identity;
  if (!same(beforeIdentity, afterIdentity)) areas.push("identity");
  if (!same(beforeAgama, afterAgama)) areas.push("identity.sampradayaAgama");
  for (const area of TOP_LEVEL) {
    if (!same(before[area], after[area])) areas.push(area);
  }
  return areas;
}

/** Areas in `areas` that `role` may not change. Empty means the change is allowed. */
export function forbiddenAreas(role: GrantRole, areas: Area[]): Area[] {
  const allowed = EDITABLE_AREAS[role];
  return areas.filter((a) => !allowed.includes(a));
}

/** The subset of `areas` this role's word can make authority-verified. */
export function vouchableAreas(role: GrantRole, areas: Area[]): Area[] {
  const vouched = VOUCHED_AREAS[role] ?? [];
  return areas.filter((a) => vouched.includes(a));
}

/**
 * The approved version of a revision: `proposed`, with every record in `areas`
 * stamped authority-verified by `role`. Callers pass only areas the role
 * changed or explicitly confirmed as current — see vouchableAreas().
 */
export function stampAuthority(proposed: Temple, role: GrantRole, by: string, date: string, areas: Area[]): Temple {
  const vouched = vouchableAreas(role, areas);
  const stamp = <T extends object>(record: T): T => ({
    ...record,
    verificationStatus: "authority-verified",
    lastVerifiedDate: date,
    verifiedBy: { role, username: by },
  });
  const next: Temple = structuredClone(proposed);
  for (const area of vouched) {
    if (area === "visitingInfo") next.visitingInfo = stamp(next.visitingInfo);
    else if (area === "openingHours") next.openingHours = next.openingHours.map(stamp);
    else if (area === "poojas") next.poojas = next.poojas.map(stamp);
    else if (area === "festivals") next.festivals = next.festivals.map(stamp);
    else if (area === "worshipSop") next.worshipSop = next.worshipSop.map(stamp);
    else if (area === "shrines") next.shrines = next.shrines.map(stamp);
  }
  return next;
}
