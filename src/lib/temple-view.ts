/**
 * Pure, fs-free view helpers for a Temple. Kept out of temples.ts so that
 * client components can import them without pulling in the file-system loader.
 */
import type {
  MediaItem,
  ShrinePoint,
  SourceRecord,
  Temple,
  VerificationStatus,
} from "./types";
import { PUBLISHABLE_VERIFICATION } from "./types";

/** The hero image is derived from media, not stored separately. */
export function heroImage(temple: Temple): MediaItem | undefined {
  return (
    temple.media.find((m) => m.category === "hero" && m.editorialApproved) ??
    temple.media.find((m) => m.category === "hero")
  );
}

/** Media a section may show: approved only, so unreviewed rights never render. */
export function approvedMedia(temple: Temple, categories?: MediaItem["category"][]): MediaItem[] {
  return temple.media.filter(
    (m) => m.editorialApproved && (!categories || categories.includes(m.category))
  );
}

export function resolveSources(temple: Temple, ids: string[] | undefined): SourceRecord[] {
  if (!ids?.length) return [];
  return ids
    .map((id) => temple.sources.find((s) => s.sourceId === id))
    .filter((s): s is SourceRecord => Boolean(s));
}

export function resolveMedia(temple: Temple, ids: string[] | undefined): MediaItem[] {
  if (!ids?.length) return [];
  return ids
    .map((id) => temple.media.find((m) => m.mediaId === id))
    .filter((m): m is MediaItem => Boolean(m?.editorialApproved));
}

export function resolveShrines(temple: Temple, ids: string[] | undefined): ShrinePoint[] {
  if (!ids?.length) return [];
  return ids
    .map((id) => temple.shrines.find((s) => s.shrineId === id))
    .filter((s): s is ShrinePoint => Boolean(s));
}

/**
 * The editorial rule of the directory: a claim is stated publicly only when
 * its record says a source and a reviewer stand behind it. Everything else is
 * shown as pending review rather than as fact.
 */
export function isVerified(status: VerificationStatus): boolean {
  return PUBLISHABLE_VERIFICATION.includes(status);
}

/** Sub-line under the title — derived, never stored. */
export function subtitle(temple: Temple): string {
  const place = [temple.location.city, temple.location.stateProvince].filter(Boolean).join(", ");
  return [place, temple.identity.presidingDeity].filter(Boolean).join(" · ");
}

export interface GlanceFact {
  label: string;
  value: string;
  sub?: string;
}

/** The prototype's four "At a glance" facts, computed from Temple Master. */
export function atAGlance(temple: Temple): GlanceFact[] {
  const { identity, location, governance } = temple;
  const facts: GlanceFact[] = [
    {
      label: "Presiding deity",
      value: identity.presidingDeity || "Not recorded",
      sub: [identity.presidingDeityLocal, identity.consortDeity && `Consort: ${identity.consortDeity}`]
        .filter(Boolean)
        .join(" · ") || undefined,
    },
    {
      label: "Sacred classification",
      value: identity.sacredClassifications[0] ?? identity.templeType ?? "Not recorded",
      sub: identity.sacredClassifications.slice(1).join(" · ") || identity.tradition || undefined,
    },
    {
      label: "Location",
      value: location.city || "Not recorded",
      sub: [location.district && `${location.district} District`, location.stateProvince, location.postalCode]
        .filter(Boolean)
        .join(" · ") || undefined,
    },
    {
      label: "Administration",
      value: governance.managingAuthority || "Not recorded",
      sub: governance.administrationType ?? undefined,
    },
  ];
  return facts;
}

/** Opening-hours rows disagree often enough that the page calls it out. */
export function hasTimingConflict(temple: Temple): boolean {
  return temple.openingHours.some((h) => h.verificationStatus === "conflict");
}

/**
 * The directory collects no money and shows no donation, sponsorship or
 * payment ask anywhere. Some imported seva records are worded as solicitations
 * ("Sponsor a procession of the deity...", "Sponsor free meals"), so they are
 * withheld from the public page along with the payment-shaped fields
 * (fee_note, booking_method) on every record.
 *
 * The records themselves are kept in the data and still export to the
 * workbook. To show them again once the product has a donation posture,
 * delete this function and its two call sites.
 */
const SOLICITS_MONEY = /\b(sponsor|donat|contribut|fund|pay|fee|charge|₹|rs\.?\s*\d)/i;

export function solicitsMoney(record: { nameEn?: string; description?: string; feeNote?: string }): boolean {
  if (record.feeNote) return true;
  return SOLICITS_MONEY.test(`${record.nameEn ?? ""} ${record.description ?? ""}`);
}

/** Poojas in clock order, undated ones last; money-soliciting records withheld. */
export function poojasByTime(temple: Temple) {
  return [...temple.poojas]
    .filter((pooja) => !solicitsMoney(pooja))
    .sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
}

/** SOP steps in their declared order. */
export function sopInOrder(temple: Temple) {
  return [...temple.worshipSop].sort((a, b) => a.stepNumber - b.stepNumber);
}

/**
 * Shrines for the layout section. A verified worship order is honoured;
 * otherwise they are listed in entry order with no implied sequence.
 */
export function shrinesForDisplay(temple: Temple): { shrines: ShrinePoint[]; ordered: boolean } {
  const ordered =
    temple.shrines.length > 0 &&
    temple.shrines.every((s) => s.sequenceNumber !== undefined && isVerified(s.verificationStatus));
  const shrines = ordered
    ? [...temple.shrines].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0))
    : temple.shrines;
  return { shrines, ordered };
}

/** Major festivals first; "major" is a product flag, not a schema column. */
export function festivalsForDisplay(temple: Temple) {
  const major = new Set(temple.extensions.majorFestivalIds ?? []);
  return [...temple.festivals].sort(
    (a, b) => Number(major.has(b.festivalId)) - Number(major.has(a.festivalId))
  );
}

export function isMajorFestival(temple: Temple, festivalId: string): boolean {
  return (temple.extensions.majorFestivalIds ?? []).includes(festivalId);
}
