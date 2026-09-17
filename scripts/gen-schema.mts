/**
 * Generates src/lib/schema.ts from Temple_Directory_Input_Schema.xlsx.
 *
 * The workbook's 10_Column_Dictionary is the authority for every column's data
 * type, requirement level and public section; 11_Lookups is the authority for
 * every enum. Generating rather than hand-writing the registry is what keeps
 * the contributor form, the importer and the publish gate from drifting apart.
 *
 * Run: node scripts/gen-schema.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkbook } from "../src/lib/excel/workbook";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "Temple_Directory_Input_Schema.xlsx");
const OUT = path.join(ROOT, "src", "lib", "schema.ts");

/**
 * snake_case workbook column -> dotted path in the Temple object.
 * Child-sheet columns are relative to one record in that sheet's array.
 * `null` marks a column that carries no data of its own (the join key).
 */
const PATHS = {
  "01_Temple_Master": {
    temple_id: "templeId",
    temple_slug: "slug",
    temple_name_en: "identity.nameEn",
    temple_name_local: "identity.nameLocal",
    local_language: "identity.localLanguage",
    alternate_names: "identity.alternateNames",
    presiding_deity: "identity.presidingDeity",
    presiding_deity_local: "identity.presidingDeityLocal",
    consort_deity: "identity.consortDeity",
    temple_tradition: "identity.tradition",
    sampradaya_agama: "identity.sampradayaAgama",
    temple_type: "identity.templeType",
    sacred_classifications: "identity.sacredClassifications",
    spiritual_significance_short: "identity.spiritualSignificanceShort",
    city: "location.city",
    district: "location.district",
    state_province: "location.stateProvince",
    country: "location.country",
    postal_code: "location.postalCode",
    latitude: "location.latitude",
    longitude: "location.longitude",
    map_url: "location.mapUrl",
    established_era: "governance.establishedEra",
    founder_patron: "governance.founderPatron",
    managing_authority: "governance.managingAuthority",
    administration_type: "governance.administrationType",
    official_website: "governance.officialWebsite",
    official_phone: "governance.officialPhone",
    official_email: "governance.officialEmail",
    summary_intro: "narrative.summaryIntro",
    sthala_puranam: "narrative.sthalaPuranam",
    documented_history: "narrative.documentedHistory",
    architecture_style: "narrative.architectureStyle",
    sacred_tree: "narrative.sacredTree",
    sacred_tank: "narrative.sacredTank",
    sacred_text_references: "narrative.sacredTextReferences",
    associated_saints: "narrative.associatedSaints",
    inscriptions_summary: "narrative.inscriptionsSummary",
    primary_language: "editorial.primaryLanguage",
    public_status: "status",
    overall_verification_status: "editorial.overallVerificationStatus",
    last_verified_date: "editorial.lastVerifiedDate",
    verification_notes: "editorial.verificationNotes",
  },
  "02_Visiting_Info": {
    temple_id: null,
    dress_code: "dressCode",
    entry_rules: "entryRules",
    footwear_rules: "footwearRules",
    photography_policy: "photographyPolicy",
    mobile_policy: "mobilePolicy",
    prasad_info: "prasadInfo",
    accessibility_notes: "accessibilityNotes",
    parking_notes: "parkingNotes",
    accommodation_notes: "accommodationNotes",
    nearest_rail_station: "nearestRailStation",
    rail_distance_km: "railDistanceKm",
    nearest_bus_station: "nearestBusStation",
    bus_distance_km: "busDistanceKm",
    nearest_airport: "nearestAirport",
    airport_distance_km: "airportDistanceKm",
    official_contact_note: "officialContactNote",
    source_ids: "sourceIds",
    last_verified_date: "lastVerifiedDate",
    verification_status: "verificationStatus",
  },
  "03_Opening_Hours": {
    temple_id: null,
    hours_id: "hoursId",
    day_type: "dayType",
    valid_from: "validFrom",
    valid_to: "validTo",
    session_name: "sessionName",
    open_time: "openTime",
    close_time: "closeTime",
    closed_flag: "closedFlag",
    festival_override: "festivalOverride",
    notes: "notes",
    source_ids: "sourceIds",
    last_verified_date: "lastVerifiedDate",
    verification_status: "verificationStatus",
  },
  "04_Worship_SOP": {
    temple_id: null,
    sop_step_id: "sopStepId",
    step_number: "stepNumber",
    step_title: "stepTitle",
    instruction: "instruction",
    explanation: "explanation",
    local_terms: "localTerms",
    mantra_or_sloka: "mantraOrSloka",
    what_to_carry: "whatToCarry",
    restriction_or_caution: "restrictionOrCaution",
    linked_shrine_ids: "linkedShrineIds",
    linked_media_ids: "linkedMediaIds",
    source_ids: "sourceIds",
    authority_reviewer: "authorityReviewer",
    authority_review_date: "authorityReviewDate",
    verification_status: "verificationStatus",
    editor_notes: "editorNotes",
  },
  "05_Shrines_Route": {
    temple_id: null,
    shrine_id: "shrineId",
    sequence_number: "sequenceNumber",
    shrine_name: "shrineName",
    deity_or_subject: "deityOrSubject",
    local_name: "localName",
    space_type: "spaceType",
    location_description: "locationDescription",
    route_direction: "routeDirection",
    recommended_action: "recommendedAction",
    pradakshina_count: "pradakshinaCount",
    linked_media_ids: "linkedMediaIds",
    source_ids: "sourceIds",
    verification_status: "verificationStatus",
  },
  "06_Pooja_Seva": {
    temple_id: null,
    pooja_id: "poojaId",
    record_type: "recordType",
    name_en: "nameEn",
    name_local: "nameLocal",
    start_time: "startTime",
    end_time: "endTime",
    recurrence: "recurrence",
    description: "description",
    devotee_participation: "devoteeParticipation",
    booking_method: "bookingMethod",
    fee_note: "feeNote",
    linked_media_ids: "linkedMediaIds",
    source_ids: "sourceIds",
    last_verified_date: "lastVerifiedDate",
    verification_status: "verificationStatus",
  },
  "07_Festivals": {
    temple_id: null,
    festival_id: "festivalId",
    festival_name_en: "festivalNameEn",
    festival_name_local: "festivalNameLocal",
    tamil_or_local_month: "tamilOrLocalMonth",
    gregorian_rule_or_date: "gregorianRuleOrDate",
    duration: "duration",
    significance: "significance",
    procession_or_rituals: "processionOrRituals",
    crowd_note: "crowdNote",
    visitor_advice: "visitorAdvice",
    linked_media_ids: "linkedMediaIds",
    source_ids: "sourceIds",
    verification_status: "verificationStatus",
  },
  "08_Media": {
    temple_id: null,
    media_id: "mediaId",
    media_type: "mediaType",
    category: "category",
    title: "title",
    caption: "caption",
    alt_text: "altText",
    file_or_url: "fileOrUrl",
    creator: "creator",
    capture_date: "captureDate",
    license: "license",
    attribution_text: "attributionText",
    source_url: "sourceUrl",
    linked_sop_step_id: "linkedSopStepId",
    linked_shrine_id: "linkedShrineId",
    editorial_approved: "editorialApproved",
    verification_status: "verificationStatus",
  },
  "09_Sources": {
    source_id: "sourceId",
    temple_id: null,
    source_type: "sourceType",
    title: "title",
    publisher_or_authority: "publisherOrAuthority",
    author: "author",
    url: "url",
    publication_date: "publicationDate",
    access_date: "accessDate",
    page_or_section: "pageOrSection",
    claim_scope: "claimScope",
    reliability_note: "reliabilityNote",
    archived_url: "archivedUrl",
    admin_approved: "adminApproved",
  },
};

/** Columns that hold a semicolon-separated list rather than one value. */
const LIST_COLUMNS = new Set([
  "alternate_names",
  "sacred_classifications",
  "associated_saints",
  "source_ids",
  "linked_media_ids",
  "linked_shrine_ids",
]);

/** Which 11_Lookups column governs which schema column. */
const LOOKUP_FOR = {
  temple_tradition: "Temple Tradition",
  administration_type: "Administration Type",
  public_status: "Public Status",
  overall_verification_status: "Verification Status",
  verification_status: "Verification Status",
  media_type: "Media Type",
  category: "Media Category",
  source_type: "Source Type",
  space_type: "Space Type",
  record_type: "Record Type",
  day_type: "Day Type",
  local_language: "Language",
  primary_language: "Language",
};

const wb = await readWorkbook(fs.readFileSync(SRC));

/* ---- lookups ---- */
const lookupSheet = wb.getWorksheet("11_Lookups");
const lookupHeaders = [];
lookupSheet.getRow(1).eachCell((cell, col) => {
  lookupHeaders[col] = String(cell.text).trim();
});
const LOOKUPS = {};
for (let col = 1; col < lookupHeaders.length; col += 1) {
  const name = lookupHeaders[col];
  if (!name) continue;
  const values = [];
  for (let row = 2; row <= lookupSheet.rowCount; row += 1) {
    const text = String(lookupSheet.getRow(row).getCell(col).text ?? "").trim();
    if (text) values.push(text);
  }
  LOOKUPS[name] = values;
}

/* ---- column dictionary ---- */
const dict = wb.getWorksheet("10_Column_Dictionary");
const specs = [];
const unmapped = [];
for (let row = 2; row <= dict.rowCount; row += 1) {
  const r = dict.getRow(row);
  const sheet = String(r.getCell(1).text ?? "").trim();
  const column = String(r.getCell(2).text ?? "").trim();
  if (!sheet || !column) continue;
  const map = PATHS[sheet];
  if (!map) {
    unmapped.push(`${sheet} (whole sheet)`);
    continue;
  }
  if (!(column in map)) {
    unmapped.push(`${sheet}.${column}`);
    continue;
  }
  const lookupName = LOOKUP_FOR[column];
  specs.push({
    sheet,
    column,
    path: map[column],
    dataType: String(r.getCell(3).text ?? "Text").trim(),
    requirement: String(r.getCell(4).text ?? "Optional").trim(),
    repeatable: String(r.getCell(5).text ?? "No").trim().toLowerCase() === "yes",
    description: String(r.getCell(6).text ?? "").trim(),
    sourceRequired: String(r.getCell(7).text ?? "").trim(),
    publicSection: String(r.getCell(8).text ?? "").trim(),
    list: LIST_COLUMNS.has(column),
    lookup: lookupName && LOOKUPS[lookupName] ? lookupName : undefined,
  });
}

if (unmapped.length) {
  console.error("Columns in the dictionary with no path mapping:\n  " + unmapped.join("\n  "));
  process.exit(1);
}

const q = (v) => JSON.stringify(v);
const lines = specs.map((s) => {
  const parts = [
    `sheet: ${q(s.sheet)}`,
    `column: ${q(s.column)}`,
    `path: ${s.path === null ? "null" : q(s.path)}`,
    `dataType: ${q(s.dataType)}`,
    `requirement: ${q(s.requirement)}`,
    `repeatable: ${s.repeatable}`,
    `publicSection: ${q(s.publicSection)}`,
    `sourceRequired: ${q(s.sourceRequired)}`,
  ];
  if (s.list) parts.push("list: true");
  if (s.lookup) parts.push(`lookup: ${q(s.lookup)}`);
  parts.push(`description: ${q(s.description)}`);
  return `  { ${parts.join(", ")} },`;
});

const out = `/**
 * GENERATED FILE — do not edit by hand.
 * Run \`npm run gen:schema\` after changing Temple_Directory_Input_Schema.xlsx.
 *
 * Source of truth for every column in the input workbook: its data type,
 * whether it is required, which repeatable sheet it belongs to, and which
 * section of the public page it feeds. This one table drives the contributor
 * form, the Excel importer/exporter, the completeness score and the publish
 * gate, so none of them can disagree about what a temple record needs.
 */

export type SheetId =
${Object.keys(PATHS).map((s) => `  | ${q(s)}`).join("\n")};

export type DataType =
  | "Text"
  | "Long text"
  | "Lookup"
  | "Date"
  | "Time"
  | "Decimal"
  | "Integer"
  | "Boolean"
  | "URL"
  | "URL/Text"
  | "Date/Text";

export type Requirement = "Required" | "Recommended" | "Optional";

export interface FieldSpec {
  /** Workbook sheet this column lives on. */
  sheet: SheetId;
  /** snake_case header, exactly as it appears in the workbook. */
  column: string;
  /**
   * Dotted path into the Temple object. For sheet 01 it is absolute; for the
   * child sheets it is relative to one record in that sheet's array.
   * \`null\` marks the temple_id join key, which carries no data of its own.
   */
  path: string | null;
  dataType: DataType;
  requirement: Requirement;
  repeatable: boolean;
  /** Which section of the public page this column feeds. */
  publicSection: string;
  sourceRequired: string;
  /** Semicolon-separated list column. */
  list?: boolean;
  /** Key into LOOKUPS when the column is constrained to an enum. */
  lookup?: string;
  description: string;
}

/** Enumerated vocabularies from the workbook's 11_Lookups sheet. */
export const LOOKUPS: Record<string, string[]> = ${JSON.stringify(LOOKUPS, null, 2)};

/** Which array on Temple each repeatable sheet maps to. */
export const SHEET_COLLECTION: Record<SheetId, keyof import("./types").Temple | null> = {
  "01_Temple_Master": null,
  "02_Visiting_Info": "visitingInfo",
  "03_Opening_Hours": "openingHours",
  "04_Worship_SOP": "worshipSop",
  "05_Shrines_Route": "shrines",
  "06_Pooja_Seva": "poojas",
  "07_Festivals": "festivals",
  "08_Media": "media",
  "09_Sources": "sources",
};

export const FIELD_SPECS: FieldSpec[] = [
${lines.join("\n")}
];

export function specsForSheet(sheet: SheetId): FieldSpec[] {
  return FIELD_SPECS.filter((s) => s.sheet === sheet);
}

export function requiredSpecs(sheet: SheetId): FieldSpec[] {
  return specsForSheet(sheet).filter((s) => s.requirement === "Required" && s.path !== null);
}

/** Distinct public sections, in workbook order — the page's section list. */
export const PUBLIC_SECTIONS: string[] = ${q([...new Set(specs.map((s) => s.publicSection).filter(Boolean))])};
`;

fs.writeFileSync(OUT, out, "utf8");
console.log(`wrote ${OUT} — ${specs.length} columns, ${Object.keys(LOOKUPS).length} lookups`);
