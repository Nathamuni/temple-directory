import type { Temple, Reference } from "./types";

export interface ContributionInput {
  name: string;
  subtitle: string;
  deityPresiding: string;
  deityConsort?: string;
  locationCity: string;
  locationDistrict?: string;
  locationState: string;
  locationCountry: string;
  locationAddress?: string;
  locationLat: number;
  locationLng: number;
  templeType: string;
  tradition: string;
  architecturalStyle: string;
  tags: string[];
  establishedPeriod: string;
  establishedYearText: string;
  governingBody: string;
  introParagraph: string;
  heroImageSrc: string;
  heroImageAlt: string;
  heroImageCaption?: string;
  heroImageAuthor: string;
  heroImageLicense: string;
  heroImageSourceUrl: string;
  contactPhone?: string;
  contactEmail?: string;
  contactAddress: string;
  references: { title: string; url?: string; publisher?: string }[];
}

export interface ValidationError {
  field: string;
  message: string;
}

const REQUIRED_STRING_FIELDS: [keyof ContributionInput, string][] = [
  ["name", "Temple name"],
  ["subtitle", "Subtitle"],
  ["deityPresiding", "Presiding deity"],
  ["locationCity", "City"],
  ["locationState", "State"],
  ["locationCountry", "Country"],
  ["templeType", "Temple type"],
  ["tradition", "Tradition"],
  ["architecturalStyle", "Architectural style"],
  ["establishedPeriod", "Established period"],
  ["establishedYearText", "Established year note"],
  ["governingBody", "Governing body"],
  ["introParagraph", "Introduction paragraph"],
  ["heroImageSrc", "Hero image URL"],
  ["heroImageAlt", "Hero image alt text"],
  ["heroImageAuthor", "Hero image author/credit"],
  ["heroImageLicense", "Hero image license"],
  ["heroImageSourceUrl", "Hero image source URL"],
  ["contactAddress", "Contact address"],
];

export function validateContribution(input: Partial<ContributionInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [field, label] of REQUIRED_STRING_FIELDS) {
    const value = input[field];
    if (typeof value !== "string" || value.trim() === "") {
      errors.push({ field, message: `${label} is required` });
    }
  }

  if (typeof input.locationLat !== "number" || Number.isNaN(input.locationLat)) {
    errors.push({ field: "locationLat", message: "Latitude must be a number" });
  }
  if (typeof input.locationLng !== "number" || Number.isNaN(input.locationLng)) {
    errors.push({ field: "locationLng", message: "Longitude must be a number" });
  }

  const refs = input.references ?? [];
  const validRefs = refs.filter((r) => r?.title?.trim());
  if (validRefs.length < 2) {
    errors.push({ field: "references", message: "At least 2 references (with a title) are required" });
  }

  return errors;
}

export function buildDraftTemple(slug: string, input: ContributionInput): Temple {
  const references: Reference[] = input.references
    .filter((r) => r.title?.trim())
    .map((r, i) => ({ id: i + 1, title: r.title, publisher: r.publisher, url: r.url }));

  return {
    slug,
    status: "draft",
    stub: true,
    name: input.name,
    subtitle: input.subtitle,
    deity: { presiding: input.deityPresiding, consort: input.deityConsort || undefined },
    location: {
      city: input.locationCity,
      district: input.locationDistrict || undefined,
      state: input.locationState,
      country: input.locationCountry,
      address: input.locationAddress || undefined,
      coordinates: { lat: input.locationLat, lng: input.locationLng },
    },
    classification: {
      templeType: input.templeType,
      tradition: input.tradition,
      architecturalStyle: input.architecturalStyle,
      tags: input.tags ?? [],
    },
    established: { period: input.establishedPeriod, yearText: input.establishedYearText },
    governingBody: input.governingBody,
    timings: { darshan: [], pujaSchedule: [] },
    heroImage: {
      src: input.heroImageSrc,
      alt: input.heroImageAlt,
      caption: input.heroImageCaption || undefined,
      credit: {
        author: input.heroImageAuthor,
        license: input.heroImageLicense,
        sourceUrl: input.heroImageSourceUrl,
      },
    },
    atAGlance: [],
    sections: {
      introduction: { paragraphs: [input.introParagraph] },
      history: { paragraphs: [] },
      architecture: { paragraphs: [] },
      religiousSignificance: { paragraphs: [] },
      administration: { paragraphs: [] },
      donationsAndServices: { paragraphs: [] },
    },
    worshipSOP: {
      steps: [],
      entryGuidelines: [],
      specialRituals: [],
      restrictions: [],
      spiritualOutcomes: [],
    },
    festivals: [],
    visitingInfo: { bestTime: "", dressCode: "", howToReach: {}, facilities: [] },
    lamp: { enabled: false, lampsToday: 0 },
    gallery: [],
    nearbyTemples: [],
    reviews: [],
    contact: {
      phone: input.contactPhone || undefined,
      email: input.contactEmail || undefined,
      address: input.contactAddress,
    },
    references,
  };
}
