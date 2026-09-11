/**
 * Temple Directory — canonical data schema.
 * Every temple is one JSON file in data/temples/<slug>.json conforming to `Temple`.
 * The annotated fill-in template for contributors lives at data/TEMPLE_TEMPLATE.jsonc.
 */

export interface ImageCredit {
  author: string;
  license: string;
  sourceUrl: string;
}

export interface ImageRef {
  src: string;
  alt: string;
  caption?: string;
  credit: ImageCredit;
}

export interface WikiSection {
  paragraphs: string[];
  /** Indexes into `references` (1-based reference ids) cited by this section. */
  citations?: number[];
}

export interface SOPStep {
  title: string;
  points: string[];
}

export interface SpecialRitual {
  ritual: string;
  description: string;
  howToBook: string;
}

export interface Festival {
  name: string;
  month: string;
  duration?: string;
  description: string;
  major: boolean;
}

export interface Reference {
  id: number;
  title: string;
  publisher?: string;
  url?: string;
  accessed?: string;
}

export interface Review {
  author: string;
  rating: number;
  date: string;
  text: string;
}

/** Editorial workflow state of an entry. */
export type TempleStatus = "draft" | "pending" | "verified" | "published";

export interface Temple {
  slug: string;
  /** Editorial status: draft → pending (awaiting review) → verified (priest/source-checked) → published. */
  status: TempleStatus;
  name: string;
  nameLocal?: { script: string; text: string };
  subtitle: string;
  deity: { presiding: string; consort?: string; others?: string[] };
  location: {
    city: string;
    district?: string;
    state: string;
    country: string;
    address?: string;
    coordinates: { lat: number; lng: number };
  };
  classification: {
    templeType: string;
    tradition: string;
    architecturalStyle: string;
    divyaDesam?: number | null;
    tags: string[];
  };
  established: { period: string; yearText: string };
  governingBody: string;
  website?: string;
  timings: {
    darshan: { label: string; from: string; to: string }[];
    pujaSchedule: { time: string; name: string }[];
  };
  heroImage: ImageRef;
  atAGlance: { icon: string; label: string; value: string }[];
  sections: {
    introduction: WikiSection;
    history: WikiSection;
    architecture: WikiSection;
    religiousSignificance: WikiSection;
    administration: WikiSection;
    donationsAndServices: WikiSection;
  };
  worshipSOP: {
    /** Exactly 6 steps, in the standard order. */
    steps: SOPStep[];
    entryGuidelines: string[];
    specialRituals: SpecialRitual[];
    restrictions: string[];
    spiritualOutcomes: string[];
  };
  festivals: Festival[];
  visitingInfo: {
    bestTime: string;
    dressCode: string;
    howToReach: { air?: string; rail?: string; road?: string };
    facilities: string[];
    entryFee?: string;
    nearbyAttractions?: string[];
  };
  lamp: { enabled: boolean; lampsToday: number };
  gallery: ImageRef[];
  nearbyTemples: { name: string; distanceKm: number; slug?: string }[];
  reviews: Review[];
  contact: { phone?: string; email?: string; address: string };
  /** Minimum 2 — enforced at build time. */
  references: Reference[];
  /** Thin entries (stubs) render a reduced page; full zones require stub: false/absent. */
  stub?: boolean;
}
