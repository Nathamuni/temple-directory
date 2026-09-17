/**
 * GENERATED FILE — do not edit by hand.
 * Run `npm run gen:schema` after changing Temple_Directory_Input_Schema.xlsx.
 *
 * Source of truth for every column in the input workbook: its data type,
 * whether it is required, which repeatable sheet it belongs to, and which
 * section of the public page it feeds. This one table drives the contributor
 * form, the Excel importer/exporter, the completeness score and the publish
 * gate, so none of them can disagree about what a temple record needs.
 */

export type SheetId =
  | "01_Temple_Master"
  | "02_Visiting_Info"
  | "03_Opening_Hours"
  | "04_Worship_SOP"
  | "05_Shrines_Route"
  | "06_Pooja_Seva"
  | "07_Festivals"
  | "08_Media"
  | "09_Sources";

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
   * `null` marks the temple_id join key, which carries no data of its own.
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
export const LOOKUPS: Record<string, string[]> = {
  "Temple Tradition": [
    "Shaiva",
    "Vaishnava",
    "Shakta",
    "Smarta",
    "Ganapatya",
    "Kaumara/Murugan",
    "Other"
  ],
  "Administration Type": [
    "Government department",
    "Public trust",
    "Private trust",
    "Hereditary administration",
    "Temple committee",
    "Monastic institution",
    "Other"
  ],
  "Public Status": [
    "draft",
    "pending",
    "verified",
    "published",
    "rejected"
  ],
  "Verification Status": [
    "unverified",
    "partial",
    "sourced",
    "cross-referenced",
    "authority-verified",
    "verified",
    "conflict",
    "needs recheck",
    "pending",
    "approved",
    "rejected"
  ],
  "Media Type": [
    "image",
    "video",
    "audio",
    "map",
    "document"
  ],
  "Media Category": [
    "hero",
    "exterior",
    "gopuram",
    "tank",
    "shrine",
    "SOP",
    "festival",
    "architecture",
    "signage",
    "accessibility",
    "map",
    "other"
  ],
  "Source Type": [
    "official temple",
    "government",
    "scripture",
    "academic",
    "inscription",
    "priest/temple authority",
    "on-site observation",
    "media repository",
    "other"
  ],
  "Space Type": [
    "shrine",
    "sabha",
    "tank",
    "sacred tree",
    "gopuram",
    "hall",
    "prakaram",
    "other"
  ],
  "Record Type": [
    "pooja",
    "aarti",
    "seva",
    "abhishekam",
    "archana",
    "other"
  ],
  "Day Type": [
    "daily",
    "weekday",
    "weekend",
    "festival",
    "special"
  ],
  "Language": [
    "English",
    "Tamil",
    "Hindi",
    "Telugu",
    "Kannada",
    "Malayalam",
    "Sanskrit",
    "Other"
  ]
};

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
  { sheet: "01_Temple_Master", column: "temple_id", path: "templeId", dataType: "Text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Stable internal ID, e.g. TPL-IN-TN-CUD-0001" },
  { sheet: "01_Temple_Master", column: "temple_slug", path: "slug", dataType: "Text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Public URL slug" },
  { sheet: "01_Temple_Master", column: "temple_name_en", path: "identity.nameEn", dataType: "Text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Official/common English name" },
  { sheet: "01_Temple_Master", column: "temple_name_local", path: "identity.nameLocal", dataType: "Text", requirement: "Recommended", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Name in regional script" },
  { sheet: "01_Temple_Master", column: "local_language", path: "identity.localLanguage", dataType: "Lookup", requirement: "Recommended", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", lookup: "Language", description: "Primary local language" },
  { sheet: "01_Temple_Master", column: "alternate_names", path: "identity.alternateNames", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", list: true, description: "Semicolon-separated alternate names" },
  { sheet: "01_Temple_Master", column: "presiding_deity", path: "identity.presidingDeity", dataType: "Text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Main deity" },
  { sheet: "01_Temple_Master", column: "presiding_deity_local", path: "identity.presidingDeityLocal", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Regional-script deity name" },
  { sheet: "01_Temple_Master", column: "consort_deity", path: "identity.consortDeity", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Consort / paired deity where relevant" },
  { sheet: "01_Temple_Master", column: "temple_tradition", path: "identity.tradition", dataType: "Lookup", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", lookup: "Temple Tradition", description: "Shaiva / Vaishnava / Shakta / etc." },
  { sheet: "01_Temple_Master", column: "sampradaya_agama", path: "identity.sampradayaAgama", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Specific sampradaya/agama only if sourced" },
  { sheet: "01_Temple_Master", column: "temple_type", path: "identity.templeType", dataType: "Lookup", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Temple type/category" },
  { sheet: "01_Temple_Master", column: "sacred_classifications", path: "identity.sacredClassifications", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", list: true, description: "Pancha Bhuta, Divya Desam, Jyotirlinga, etc." },
  { sheet: "01_Temple_Master", column: "spiritual_significance_short", path: "identity.spiritualSignificanceShort", dataType: "Long text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Short devotional significance shown near top" },
  { sheet: "01_Temple_Master", column: "city", path: "location.city", dataType: "Text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "City/town" },
  { sheet: "01_Temple_Master", column: "district", path: "location.district", dataType: "Text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "District/county" },
  { sheet: "01_Temple_Master", column: "state_province", path: "location.stateProvince", dataType: "Text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "State/province" },
  { sheet: "01_Temple_Master", column: "country", path: "location.country", dataType: "Text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Country" },
  { sheet: "01_Temple_Master", column: "postal_code", path: "location.postalCode", dataType: "Text", requirement: "Recommended", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "PIN/ZIP/postcode" },
  { sheet: "01_Temple_Master", column: "latitude", path: "location.latitude", dataType: "Decimal", requirement: "Recommended", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Latitude" },
  { sheet: "01_Temple_Master", column: "longitude", path: "location.longitude", dataType: "Decimal", requirement: "Recommended", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Longitude" },
  { sheet: "01_Temple_Master", column: "map_url", path: "location.mapUrl", dataType: "URL", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Map link" },
  { sheet: "01_Temple_Master", column: "established_era", path: "governance.establishedEra", dataType: "Text", requirement: "Recommended", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Era / century; avoid false precision" },
  { sheet: "01_Temple_Master", column: "founder_patron", path: "governance.founderPatron", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Founder / patron if documented" },
  { sheet: "01_Temple_Master", column: "managing_authority", path: "governance.managingAuthority", dataType: "Text", requirement: "Recommended", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Trust, board, department, committee" },
  { sheet: "01_Temple_Master", column: "administration_type", path: "governance.administrationType", dataType: "Lookup", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", lookup: "Administration Type", description: "Trust / govt / hereditary / committee / other" },
  { sheet: "01_Temple_Master", column: "official_website", path: "governance.officialWebsite", dataType: "URL", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Official site" },
  { sheet: "01_Temple_Master", column: "official_phone", path: "governance.officialPhone", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Public phone" },
  { sheet: "01_Temple_Master", column: "official_email", path: "governance.officialEmail", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Public email" },
  { sheet: "01_Temple_Master", column: "summary_intro", path: "narrative.summaryIntro", dataType: "Long text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "100–180 word page introduction" },
  { sheet: "01_Temple_Master", column: "sthala_puranam", path: "narrative.sthalaPuranam", dataType: "Long text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Traditional / devotional account, clearly labelled" },
  { sheet: "01_Temple_Master", column: "documented_history", path: "narrative.documentedHistory", dataType: "Long text", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Historically documented chronology" },
  { sheet: "01_Temple_Master", column: "architecture_style", path: "narrative.architectureStyle", dataType: "Text", requirement: "Recommended", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Dravidian / Nagara / Vesara / regional" },
  { sheet: "01_Temple_Master", column: "sacred_tree", path: "narrative.sacredTree", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Sthala Vriksham" },
  { sheet: "01_Temple_Master", column: "sacred_tank", path: "narrative.sacredTank", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Theertham / sacred tank" },
  { sheet: "01_Temple_Master", column: "sacred_text_references", path: "narrative.sacredTextReferences", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Textual references; detailed citations live in Sources" },
  { sheet: "01_Temple_Master", column: "associated_saints", path: "narrative.associatedSaints", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", list: true, description: "Saints/acharyas/poets" },
  { sheet: "01_Temple_Master", column: "inscriptions_summary", path: "narrative.inscriptionsSummary", dataType: "Long text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Summary of inscriptions / epigraphy" },
  { sheet: "01_Temple_Master", column: "primary_language", path: "editorial.primaryLanguage", dataType: "Lookup", requirement: "Recommended", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", lookup: "Language", description: "Default content language" },
  { sheet: "01_Temple_Master", column: "public_status", path: "status", dataType: "Lookup", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", lookup: "Public Status", description: "draft / pending / verified / published / rejected" },
  { sheet: "01_Temple_Master", column: "overall_verification_status", path: "editorial.overallVerificationStatus", dataType: "Lookup", requirement: "Required", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", lookup: "Verification Status", description: "unverified / partial / cross-referenced / authority-verified" },
  { sheet: "01_Temple_Master", column: "last_verified_date", path: "editorial.lastVerifiedDate", dataType: "Date", requirement: "Recommended", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Overall last verification date" },
  { sheet: "01_Temple_Master", column: "verification_notes", path: "editorial.verificationNotes", dataType: "Long text", requirement: "Optional", repeatable: false, publicSection: "Identity / History", sourceRequired: "Recommended", description: "Admin/editor notes" },
  { sheet: "02_Visiting_Info", column: "temple_id", path: null, dataType: "Text", requirement: "Required", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Link to Temple Master" },
  { sheet: "02_Visiting_Info", column: "dress_code", path: "dressCode", dataType: "Long text", requirement: "Recommended", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Current temple-specific dress requirements" },
  { sheet: "02_Visiting_Info", column: "entry_rules", path: "entryRules", dataType: "Long text", requirement: "Recommended", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Entry restrictions / special rules" },
  { sheet: "02_Visiting_Info", column: "footwear_rules", path: "footwearRules", dataType: "Long text", requirement: "Recommended", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Removal/storage guidance" },
  { sheet: "02_Visiting_Info", column: "photography_policy", path: "photographyPolicy", dataType: "Long text", requirement: "Recommended", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Still/video policy; date-stamp it" },
  { sheet: "02_Visiting_Info", column: "mobile_policy", path: "mobilePolicy", dataType: "Long text", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Phone/device rules" },
  { sheet: "02_Visiting_Info", column: "prasad_info", path: "prasadInfo", dataType: "Long text", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Counter/location/timings" },
  { sheet: "02_Visiting_Info", column: "accessibility_notes", path: "accessibilityNotes", dataType: "Long text", requirement: "Recommended", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Wheelchair/senior citizen/assistance info" },
  { sheet: "02_Visiting_Info", column: "parking_notes", path: "parkingNotes", dataType: "Long text", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Parking location/capacity" },
  { sheet: "02_Visiting_Info", column: "accommodation_notes", path: "accommodationNotes", dataType: "Long text", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Temple choultry/dharamshala/nearby stays" },
  { sheet: "02_Visiting_Info", column: "nearest_rail_station", path: "nearestRailStation", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Nearest rail station" },
  { sheet: "02_Visiting_Info", column: "rail_distance_km", path: "railDistanceKm", dataType: "Decimal", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Approx distance" },
  { sheet: "02_Visiting_Info", column: "nearest_bus_station", path: "nearestBusStation", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Nearest bus station" },
  { sheet: "02_Visiting_Info", column: "bus_distance_km", path: "busDistanceKm", dataType: "Decimal", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Approx distance" },
  { sheet: "02_Visiting_Info", column: "nearest_airport", path: "nearestAirport", dataType: "Text", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Nearest airport" },
  { sheet: "02_Visiting_Info", column: "airport_distance_km", path: "airportDistanceKm", dataType: "Decimal", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Approx distance" },
  { sheet: "02_Visiting_Info", column: "official_contact_note", path: "officialContactNote", dataType: "Long text", requirement: "Optional", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "How to confirm same-day info" },
  { sheet: "02_Visiting_Info", column: "source_ids", path: "sourceIds", dataType: "Text", requirement: "Required", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", list: true, description: "Semicolon-separated Source IDs" },
  { sheet: "02_Visiting_Info", column: "last_verified_date", path: "lastVerifiedDate", dataType: "Date", requirement: "Required", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Date practical info was checked" },
  { sheet: "02_Visiting_Info", column: "verification_status", path: "verificationStatus", dataType: "Lookup", requirement: "Required", repeatable: false, publicSection: "Plan your visit", sourceRequired: "Yes", lookup: "Verification Status", description: "unverified / partial / verified / conflict" },
  { sheet: "03_Opening_Hours", column: "temple_id", path: null, dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Link to temple" },
  { sheet: "03_Opening_Hours", column: "hours_id", path: "hoursId", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Unique schedule row ID" },
  { sheet: "03_Opening_Hours", column: "day_type", path: "dayType", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", lookup: "Day Type", description: "daily / weekday / weekend / festival / special" },
  { sheet: "03_Opening_Hours", column: "valid_from", path: "validFrom", dataType: "Date", requirement: "Optional", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Effective start date" },
  { sheet: "03_Opening_Hours", column: "valid_to", path: "validTo", dataType: "Date", requirement: "Optional", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Effective end date" },
  { sheet: "03_Opening_Hours", column: "session_name", path: "sessionName", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Morning / Evening / Special" },
  { sheet: "03_Opening_Hours", column: "open_time", path: "openTime", dataType: "Time", requirement: "Optional", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Opening time" },
  { sheet: "03_Opening_Hours", column: "close_time", path: "closeTime", dataType: "Time", requirement: "Optional", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Closing time" },
  { sheet: "03_Opening_Hours", column: "closed_flag", path: "closedFlag", dataType: "Boolean", requirement: "Required", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "TRUE if closed" },
  { sheet: "03_Opening_Hours", column: "festival_override", path: "festivalOverride", dataType: "Boolean", requirement: "Optional", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Whether this is an override" },
  { sheet: "03_Opening_Hours", column: "notes", path: "notes", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Breaks / queue / variation notes" },
  { sheet: "03_Opening_Hours", column: "source_ids", path: "sourceIds", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", list: true, description: "Supporting sources" },
  { sheet: "03_Opening_Hours", column: "last_verified_date", path: "lastVerifiedDate", dataType: "Date", requirement: "Required", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", description: "Current check date" },
  { sheet: "03_Opening_Hours", column: "verification_status", path: "verificationStatus", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "Plan your visit", sourceRequired: "Yes", lookup: "Verification Status", description: "verified / conflict / needs recheck" },
  { sheet: "04_Worship_SOP", column: "temple_id", path: null, dataType: "Text", requirement: "Required", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Link to temple" },
  { sheet: "04_Worship_SOP", column: "sop_step_id", path: "sopStepId", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Unique row ID" },
  { sheet: "04_Worship_SOP", column: "step_number", path: "stepNumber", dataType: "Integer", requirement: "Required", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "1–6" },
  { sheet: "04_Worship_SOP", column: "step_title", path: "stepTitle", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Public title" },
  { sheet: "04_Worship_SOP", column: "instruction", path: "instruction", dataType: "Long text", requirement: "Required", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Temple-specific worship/visit instruction" },
  { sheet: "04_Worship_SOP", column: "explanation", path: "explanation", dataType: "Long text", requirement: "Recommended", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Why/context" },
  { sheet: "04_Worship_SOP", column: "local_terms", path: "localTerms", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Regional terms" },
  { sheet: "04_Worship_SOP", column: "mantra_or_sloka", path: "mantraOrSloka", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Only when properly sourced/approved" },
  { sheet: "04_Worship_SOP", column: "what_to_carry", path: "whatToCarry", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Offerings/items" },
  { sheet: "04_Worship_SOP", column: "restriction_or_caution", path: "restrictionOrCaution", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Temple-specific caution" },
  { sheet: "04_Worship_SOP", column: "linked_shrine_ids", path: "linkedShrineIds", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", list: true, description: "Related shrine IDs" },
  { sheet: "04_Worship_SOP", column: "linked_media_ids", path: "linkedMediaIds", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", list: true, description: "Related image/video IDs" },
  { sheet: "04_Worship_SOP", column: "source_ids", path: "sourceIds", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", list: true, description: "Supporting sources" },
  { sheet: "04_Worship_SOP", column: "authority_reviewer", path: "authorityReviewer", dataType: "Text", requirement: "Recommended", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Priest/temple authority/editor" },
  { sheet: "04_Worship_SOP", column: "authority_review_date", path: "authorityReviewDate", dataType: "Date", requirement: "Recommended", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Authority sign-off date" },
  { sheet: "04_Worship_SOP", column: "verification_status", path: "verificationStatus", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", lookup: "Verification Status", description: "draft / sourced / authority-verified / conflict" },
  { sheet: "04_Worship_SOP", column: "editor_notes", path: "editorNotes", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "How to worship", sourceRequired: "Yes", description: "Internal notes" },
  { sheet: "05_Shrines_Route", column: "temple_id", path: null, dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", description: "Link to temple" },
  { sheet: "05_Shrines_Route", column: "shrine_id", path: "shrineId", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", description: "Unique shrine ID" },
  { sheet: "05_Shrines_Route", column: "sequence_number", path: "sequenceNumber", dataType: "Integer", requirement: "Optional", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", description: "Only if exact worship order is verified" },
  { sheet: "05_Shrines_Route", column: "shrine_name", path: "shrineName", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", description: "Shrine/hall/sacred-space name" },
  { sheet: "05_Shrines_Route", column: "deity_or_subject", path: "deityOrSubject", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", description: "Deity / sacred subject" },
  { sheet: "05_Shrines_Route", column: "local_name", path: "localName", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", description: "Regional-script name" },
  { sheet: "05_Shrines_Route", column: "space_type", path: "spaceType", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", lookup: "Space Type", description: "shrine / sabha / tank / tree / gopuram / hall / other" },
  { sheet: "05_Shrines_Route", column: "location_description", path: "locationDescription", dataType: "Text", requirement: "Recommended", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", description: "Where it is in complex" },
  { sheet: "05_Shrines_Route", column: "route_direction", path: "routeDirection", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", description: "Directions from prior point" },
  { sheet: "05_Shrines_Route", column: "recommended_action", path: "recommendedAction", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", description: "Temple-specific action only if verified" },
  { sheet: "05_Shrines_Route", column: "pradakshina_count", path: "pradakshinaCount", dataType: "Integer", requirement: "Optional", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", description: "Only if verified" },
  { sheet: "05_Shrines_Route", column: "linked_media_ids", path: "linkedMediaIds", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", list: true, description: "Related media" },
  { sheet: "05_Shrines_Route", column: "source_ids", path: "sourceIds", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", list: true, description: "Supporting sources" },
  { sheet: "05_Shrines_Route", column: "verification_status", path: "verificationStatus", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "Temple layout / worship route", sourceRequired: "Yes", lookup: "Verification Status", description: "unverified / sourced / authority-verified" },
  { sheet: "06_Pooja_Seva", column: "temple_id", path: null, dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "Link to temple" },
  { sheet: "06_Pooja_Seva", column: "pooja_id", path: "poojaId", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "Unique pooja/seva ID" },
  { sheet: "06_Pooja_Seva", column: "record_type", path: "recordType", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", lookup: "Record Type", description: "pooja / aarti / seva / abhishekam / archana" },
  { sheet: "06_Pooja_Seva", column: "name_en", path: "nameEn", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "Name" },
  { sheet: "06_Pooja_Seva", column: "name_local", path: "nameLocal", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "Regional-script name" },
  { sheet: "06_Pooja_Seva", column: "start_time", path: "startTime", dataType: "Time", requirement: "Optional", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "Start time" },
  { sheet: "06_Pooja_Seva", column: "end_time", path: "endTime", dataType: "Time", requirement: "Optional", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "End time" },
  { sheet: "06_Pooja_Seva", column: "recurrence", path: "recurrence", dataType: "Text", requirement: "Recommended", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "Daily / weekly / star day / festival" },
  { sheet: "06_Pooja_Seva", column: "description", path: "description", dataType: "Long text", requirement: "Recommended", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "What the event is" },
  { sheet: "06_Pooja_Seva", column: "devotee_participation", path: "devoteeParticipation", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "How devotees may participate" },
  { sheet: "06_Pooja_Seva", column: "booking_method", path: "bookingMethod", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "Counter/online/temple contact" },
  { sheet: "06_Pooja_Seva", column: "fee_note", path: "feeNote", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "Only if current and officially sourced" },
  { sheet: "06_Pooja_Seva", column: "linked_media_ids", path: "linkedMediaIds", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", list: true, description: "Related media" },
  { sheet: "06_Pooja_Seva", column: "source_ids", path: "sourceIds", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", list: true, description: "Supporting sources" },
  { sheet: "06_Pooja_Seva", column: "last_verified_date", path: "lastVerifiedDate", dataType: "Date", requirement: "Required", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", description: "Checked date" },
  { sheet: "06_Pooja_Seva", column: "verification_status", path: "verificationStatus", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "Daily worship / sevas", sourceRequired: "Yes", lookup: "Verification Status", description: "verified / conflict / needs recheck" },
  { sheet: "07_Festivals", column: "temple_id", path: null, dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "Link to temple" },
  { sheet: "07_Festivals", column: "festival_id", path: "festivalId", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "Unique festival ID" },
  { sheet: "07_Festivals", column: "festival_name_en", path: "festivalNameEn", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "Festival name" },
  { sheet: "07_Festivals", column: "festival_name_local", path: "festivalNameLocal", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "Regional-script name" },
  { sheet: "07_Festivals", column: "tamil_or_local_month", path: "tamilOrLocalMonth", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "Local calendar month" },
  { sheet: "07_Festivals", column: "gregorian_rule_or_date", path: "gregorianRuleOrDate", dataType: "Text", requirement: "Recommended", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "Date or calculation rule" },
  { sheet: "07_Festivals", column: "duration", path: "duration", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "1 day / 10 days / etc." },
  { sheet: "07_Festivals", column: "significance", path: "significance", dataType: "Long text", requirement: "Required", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "Why it matters here" },
  { sheet: "07_Festivals", column: "procession_or_rituals", path: "processionOrRituals", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "Key temple-specific events" },
  { sheet: "07_Festivals", column: "crowd_note", path: "crowdNote", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "Operational note" },
  { sheet: "07_Festivals", column: "visitor_advice", path: "visitorAdvice", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", description: "Visit planning note" },
  { sheet: "07_Festivals", column: "linked_media_ids", path: "linkedMediaIds", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", list: true, description: "Photos/videos" },
  { sheet: "07_Festivals", column: "source_ids", path: "sourceIds", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", list: true, description: "Supporting sources" },
  { sheet: "07_Festivals", column: "verification_status", path: "verificationStatus", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "Festivals", sourceRequired: "Yes", lookup: "Verification Status", description: "verified / partial / needs recheck" },
  { sheet: "08_Media", column: "temple_id", path: null, dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Link to temple" },
  { sheet: "08_Media", column: "media_id", path: "mediaId", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Unique media ID" },
  { sheet: "08_Media", column: "media_type", path: "mediaType", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", lookup: "Media Type", description: "image / video / audio / map / document" },
  { sheet: "08_Media", column: "category", path: "category", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", lookup: "Media Category", description: "hero / gopuram / tank / shrine / SOP / festival / architecture / signage / map / other" },
  { sheet: "08_Media", column: "title", path: "title", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Short media title" },
  { sheet: "08_Media", column: "caption", path: "caption", dataType: "Long text", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "What it shows" },
  { sheet: "08_Media", column: "alt_text", path: "altText", dataType: "Long text", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Accessibility text" },
  { sheet: "08_Media", column: "file_or_url", path: "fileOrUrl", dataType: "URL/Text", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Uploaded path or URL" },
  { sheet: "08_Media", column: "creator", path: "creator", dataType: "Text", requirement: "Recommended", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Photographer/creator" },
  { sheet: "08_Media", column: "capture_date", path: "captureDate", dataType: "Date", requirement: "Optional", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Date created/captured" },
  { sheet: "08_Media", column: "license", path: "license", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Usage license / permission" },
  { sheet: "08_Media", column: "attribution_text", path: "attributionText", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Display attribution" },
  { sheet: "08_Media", column: "source_url", path: "sourceUrl", dataType: "URL", requirement: "Recommended", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Original source page" },
  { sheet: "08_Media", column: "linked_sop_step_id", path: "linkedSopStepId", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Place media within SOP" },
  { sheet: "08_Media", column: "linked_shrine_id", path: "linkedShrineId", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Place media with shrine" },
  { sheet: "08_Media", column: "editorial_approved", path: "editorialApproved", dataType: "Boolean", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", description: "Rights/content review complete?" },
  { sheet: "08_Media", column: "verification_status", path: "verificationStatus", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "Hero / gallery / inline", sourceRequired: "Recommended", lookup: "Verification Status", description: "pending / approved / rejected" },
  { sheet: "09_Sources", column: "source_id", path: "sourceId", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "References", sourceRequired: "Yes", description: "Unique source ID" },
  { sheet: "09_Sources", column: "temple_id", path: null, dataType: "Text", requirement: "Required", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "Link to temple" },
  { sheet: "09_Sources", column: "source_type", path: "sourceType", dataType: "Lookup", requirement: "Required", repeatable: true, publicSection: "References", sourceRequired: "N/A", lookup: "Source Type", description: "official temple / government / scripture / academic / inscription / priest / on-site / media / other" },
  { sheet: "09_Sources", column: "title", path: "title", dataType: "Text", requirement: "Required", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "Source title" },
  { sheet: "09_Sources", column: "publisher_or_authority", path: "publisherOrAuthority", dataType: "Text", requirement: "Recommended", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "Publisher/authority" },
  { sheet: "09_Sources", column: "author", path: "author", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "Named author" },
  { sheet: "09_Sources", column: "url", path: "url", dataType: "URL", requirement: "Optional", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "Web URL" },
  { sheet: "09_Sources", column: "publication_date", path: "publicationDate", dataType: "Date/Text", requirement: "Optional", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "Publication date/year" },
  { sheet: "09_Sources", column: "access_date", path: "accessDate", dataType: "Date", requirement: "Required", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "When checked" },
  { sheet: "09_Sources", column: "page_or_section", path: "pageOrSection", dataType: "Text", requirement: "Optional", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "Page/section/paragraph" },
  { sheet: "09_Sources", column: "claim_scope", path: "claimScope", dataType: "Long text", requirement: "Required", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "What claim(s) this source supports" },
  { sheet: "09_Sources", column: "reliability_note", path: "reliabilityNote", dataType: "Long text", requirement: "Optional", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "Limitations/conflicts" },
  { sheet: "09_Sources", column: "archived_url", path: "archivedUrl", dataType: "URL", requirement: "Optional", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "Archive link" },
  { sheet: "09_Sources", column: "admin_approved", path: "adminApproved", dataType: "Boolean", requirement: "Required", repeatable: true, publicSection: "References", sourceRequired: "N/A", description: "Source accepted by editor?" },
];

export function specsForSheet(sheet: SheetId): FieldSpec[] {
  return FIELD_SPECS.filter((s) => s.sheet === sheet);
}

export function requiredSpecs(sheet: SheetId): FieldSpec[] {
  return specsForSheet(sheet).filter((s) => s.requirement === "Required" && s.path !== null);
}

/** Distinct public sections, in workbook order — the page's section list. */
export const PUBLIC_SECTIONS: string[] = ["Identity / History","Plan your visit","How to worship","Temple layout / worship route","Daily worship / sevas","Festivals","Hero / gallery / inline","References"];
