/**
 * Temple Directory — canonical data schema.
 *
 * This mirrors Temple_Directory_Input_Schema.xlsx: one Temple Master record
 * (sheet 01) plus eight linked entity collections (sheets 02–09). Field names
 * are camelCase here and snake_case in the workbook; the mapping between the
 * two lives in src/lib/schema.ts (FIELD_SPECS), which is also what drives the
 * contributor form, import validation and the publish gate.
 *
 * Every repeatable record carries its own provenance, because the editorial
 * rule of this directory is that a spiritual instruction becomes public fact
 * only when a source and a verification state say so.
 *
 * One temple is one JSON file in data/temples/<slug>.json.
 */

/* ------------------------------------------------------------------ *
 * Provenance
 * ------------------------------------------------------------------ */

/**
 * Union of every verification vocabulary used across the workbook. Each sheet
 * allows only a subset (declared per column in FIELD_SPECS.lookup); the type
 * is shared so that provenance can be handled generically at render time.
 */
export type VerificationStatus =
  | "unverified"
  | "draft"
  | "sourced"
  | "partial"
  | "verified"
  | "cross-referenced"
  | "authority-verified"
  | "conflict"
  | "needs recheck"
  | "pending"
  | "approved"
  | "rejected";

/** Statuses that permit a claim to be stated publicly as fact. */
export const PUBLISHABLE_VERIFICATION: VerificationStatus[] = [
  "verified",
  "authority-verified",
  "cross-referenced",
  "approved",
];

/** 11_Lookups → Temple Tradition. */
export type TempleTradition =
  | "Shaiva"
  | "Vaishnava"
  | "Shakta"
  | "Smarta"
  | "Ganapatya"
  | "Kaumara/Murugan"
  | "Other";

/** 11_Lookups → Administration Type. */
export type AdministrationType =
  | "Government department"
  | "Public trust"
  | "Private trust"
  | "Hereditary administration"
  | "Temple committee"
  | "Monastic institution"
  | "Other";

/** Attached to every repeatable record: where the claim came from, and how sure we are. */
export interface Provenance {
  /** Source IDs ("SRC001;SRC002" in Excel) pointing into Temple.sources. */
  sourceIds: string[];
  verificationStatus: VerificationStatus;
  /** ISO yyyy-mm-dd. */
  lastVerifiedDate?: string;
}

/* ------------------------------------------------------------------ *
 * 02_Visiting_Info — one per temple
 * ------------------------------------------------------------------ */

export interface VisitingInfo extends Provenance {
  dressCode?: string;
  entryRules?: string;
  footwearRules?: string;
  photographyPolicy?: string;
  mobilePolicy?: string;
  prasadInfo?: string;
  accessibilityNotes?: string;
  parkingNotes?: string;
  accommodationNotes?: string;
  nearestRailStation?: string;
  railDistanceKm?: number;
  nearestBusStation?: string;
  busDistanceKm?: number;
  nearestAirport?: string;
  airportDistanceKm?: number;
  officialContactNote?: string;
}

/* ------------------------------------------------------------------ *
 * 03_Opening_Hours
 * ------------------------------------------------------------------ */

export type DayType = "daily" | "weekday" | "weekend" | "festival" | "special";

export interface OpeningHoursRow extends Provenance {
  hoursId: string;
  dayType: DayType;
  validFrom?: string;
  validTo?: string;
  /** "Morning", "Evening", "Special". */
  sessionName: string;
  openTime?: string;
  closeTime?: string;
  closedFlag: boolean;
  festivalOverride?: boolean;
  notes?: string;
}

/* ------------------------------------------------------------------ *
 * 04_Worship_SOP
 * ------------------------------------------------------------------ */

export interface SopStep extends Provenance {
  sopStepId: string;
  /** 1–6. */
  stepNumber: number;
  stepTitle: string;
  instruction: string;
  explanation?: string;
  localTerms?: string;
  /** Published only when an authority has signed it off. */
  mantraOrSloka?: string;
  whatToCarry?: string;
  restrictionOrCaution?: string;
  linkedShrineIds: string[];
  linkedMediaIds: string[];
  authorityReviewer?: string;
  authorityReviewDate?: string;
  editorNotes?: string;
}

/* ------------------------------------------------------------------ *
 * 05_Shrines_Route
 * ------------------------------------------------------------------ */

export type SpaceType =
  | "shrine"
  | "sabha"
  | "tank"
  | "sacred tree"
  | "gopuram"
  | "hall"
  | "prakaram"
  | "other";

export interface ShrinePoint extends Provenance {
  shrineId: string;
  /** Only set when the worship order itself is verified. */
  sequenceNumber?: number;
  shrineName: string;
  deityOrSubject?: string;
  localName?: string;
  spaceType: SpaceType;
  locationDescription?: string;
  routeDirection?: string;
  recommendedAction?: string;
  pradakshinaCount?: number;
  linkedMediaIds: string[];
}

/* ------------------------------------------------------------------ *
 * 06_Pooja_Seva
 * ------------------------------------------------------------------ */

export type PoojaRecordType = "pooja" | "aarti" | "seva" | "abhishekam" | "archana";

export interface PoojaSeva extends Provenance {
  poojaId: string;
  recordType: PoojaRecordType;
  nameEn: string;
  nameLocal?: string;
  startTime?: string;
  endTime?: string;
  recurrence?: string;
  description?: string;
  devoteeParticipation?: string;
  bookingMethod?: string;
  feeNote?: string;
  linkedMediaIds: string[];
}

/* ------------------------------------------------------------------ *
 * 07_Festivals
 * ------------------------------------------------------------------ */

export interface FestivalRecord extends Provenance {
  festivalId: string;
  festivalNameEn: string;
  festivalNameLocal?: string;
  tamilOrLocalMonth?: string;
  gregorianRuleOrDate?: string;
  duration?: string;
  significance: string;
  processionOrRituals?: string;
  crowdNote?: string;
  visitorAdvice?: string;
  linkedMediaIds: string[];
}

/* ------------------------------------------------------------------ *
 * 08_Media
 * ------------------------------------------------------------------ */

export type MediaType = "image" | "video" | "audio" | "map" | "document";

export type MediaCategory =
  | "hero"
  | "exterior"
  | "gopuram"
  | "tank"
  | "shrine"
  | "SOP"
  | "festival"
  | "architecture"
  | "signage"
  | "accessibility"
  | "map"
  | "other";

/**
 * Media does not carry `source_ids`: the workbook gives it creator, license,
 * attribution_text and source_url instead, because an image's provenance is
 * its rights chain, not the sources backing a factual claim.
 */
export interface MediaItem {
  mediaId: string;
  mediaType: MediaType;
  category: MediaCategory;
  title: string;
  caption: string;
  altText: string;
  /** Uploaded path under /public or an external URL. */
  fileOrUrl: string;
  creator?: string;
  captureDate?: string;
  license: string;
  attributionText: string;
  sourceUrl?: string;
  linkedSopStepId?: string;
  linkedShrineId?: string;
  /** Rights and content review complete. Unapproved media never renders. */
  editorialApproved: boolean;
  verificationStatus: VerificationStatus;
}

/* ------------------------------------------------------------------ *
 * 09_Sources
 * ------------------------------------------------------------------ */

export type SourceType =
  | "official temple"
  | "government"
  | "scripture"
  | "academic"
  | "inscription"
  | "priest/temple authority"
  | "on-site observation"
  | "media repository"
  | "other";

export interface SourceRecord {
  sourceId: string;
  sourceType: SourceType;
  title: string;
  publisherOrAuthority?: string;
  author?: string;
  url?: string;
  publicationDate?: string;
  accessDate?: string;
  pageOrSection?: string;
  /** What this source is being used to support. */
  claimScope: string;
  reliabilityNote?: string;
  archivedUrl?: string;
  adminApproved: boolean;
}

/* ------------------------------------------------------------------ *
 * Product features with no column in the workbook
 * ------------------------------------------------------------------ */

export interface Review {
  author: string;
  rating: number;
  date: string;
  text: string;
}

/**
 * Everything the product renders that the input schema does not model.
 * Round-trips through the workbook's 11_Extensions sheet so an export →
 * import cycle stays lossless.
 */
export interface TempleExtensions {
  /** Secondary deities carried over from the previous schema's deity.others. */
  otherDeities: string[];
  /** Postal address; the workbook models only city/district/state/PIN. */
  address?: string;
  /** festivalIds the previous schema flagged as major, used only for ordering. */
  majorFestivalIds: string[];
  nearbyTemples: { name: string; distanceKm: number; slug?: string }[];
  reviews: Review[];
  /** Prose from the old sections.* that the normalized schema has no home for. */
  architectureNotes?: string;
  administrationNotes?: string;
  donationsNotes?: string;
  spiritualOutcomes: string[];
  bestTime?: string;
  entryFee?: string;
  facilities: string[];
}

/* ------------------------------------------------------------------ *
 * Temple
 * ------------------------------------------------------------------ */

/** Editorial workflow state of an entry (workbook column: public_status). */
export type TempleStatus = "draft" | "pending" | "verified" | "published" | "rejected";

export interface Temple {
  /** Stable internal ID, e.g. TPL-IN-TN-CUD-0001. */
  templeId: string;
  /** Public URL slug (workbook column: temple_slug). */
  slug: string;
  status: TempleStatus;
  /** Username of the contributor who submitted this entry, if any. */
  submittedBy?: string;
  /** Why an admin rejected this entry. Present only while status is "rejected". */
  rejectionReason?: string;

  identity: {
    nameEn: string;
    nameLocal?: string;
    localLanguage?: string;
    alternateNames: string[];
    presidingDeity: string;
    presidingDeityLocal?: string;
    consortDeity?: string;
    tradition: TempleTradition | "";
    sampradayaAgama?: string;
    templeType: string;
    /** Pancha Bhuta, Divya Desam, Jyotirlinga, … */
    sacredClassifications: string[];
    /** Short devotional significance shown near the top of the page. */
    spiritualSignificanceShort: string;
  };

  location: {
    city: string;
    district: string;
    stateProvince: string;
    country: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    mapUrl?: string;
  };

  governance: {
    establishedEra?: string;
    founderPatron?: string;
    managingAuthority?: string;
    administrationType?: AdministrationType;
    officialWebsite?: string;
    officialPhone?: string;
    officialEmail?: string;
  };

  narrative: {
    /** 100–180 word page introduction. */
    summaryIntro: string;
    /** Traditional / devotional account, rendered clearly labelled as tradition. */
    sthalaPuranam?: string;
    documentedHistory: string;
    architectureStyle?: string;
    sacredTree?: string;
    sacredTank?: string;
    sacredTextReferences?: string;
    associatedSaints: string[];
    inscriptionsSummary?: string;
  };

  editorial: {
    primaryLanguage?: string;
    overallVerificationStatus: VerificationStatus;
    lastVerifiedDate?: string;
    verificationNotes?: string;
  };

  visitingInfo: VisitingInfo;
  openingHours: OpeningHoursRow[];
  worshipSop: SopStep[];
  shrines: ShrinePoint[];
  poojas: PoojaSeva[];
  festivals: FestivalRecord[];
  media: MediaItem[];
  sources: SourceRecord[];

  extensions: TempleExtensions;
}
