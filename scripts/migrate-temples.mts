/**
 * One-shot migration: the pre-2026 flat Temple shape -> the normalized
 * 9-sheet schema in src/lib/types.ts.
 *
 * Run once, review the git diff, commit. Originals are in
 * data/.backup-pre-migration/ and in git history.
 *
 *   npx tsx scripts/migrate-temples.mts [--dry-run]
 *
 * Migration invents no provenance: every record it creates starts at
 * verificationStatus "unverified" (operational records at "needs recheck",
 * which is what an un-rechecked imported timing actually is). Nothing here
 * promotes a claim to public fact.
 */
import fs from "node:fs";
import path from "node:path";
import { blankTemple } from "@/lib/blankTemple";
import type {
  MediaItem,
  SourceRecord,
  Temple,
  TempleTradition,
  VerificationStatus,
} from "@/lib/types";

const DRY = process.argv.includes("--dry-run");
const DATA_DIR = path.join(process.cwd(), "data", "temples");
const TODAY = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ *
 * The old shape, as it exists on disk today.
 * ------------------------------------------------------------------ */
interface OldImageRef {
  src: string;
  alt: string;
  caption?: string;
  credit: { author: string; license: string; sourceUrl: string };
}
interface OldSection {
  paragraphs?: string[];
  citations?: number[];
}
interface OldTemple {
  slug: string;
  status: Temple["status"];
  name: string;
  nameLocal?: { script: string; text: string };
  subtitle?: string;
  deity: { presiding: string; consort?: string; others?: string[] };
  location: {
    city: string;
    district?: string;
    state: string;
    country: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  };
  classification?: {
    templeType?: string;
    tradition?: string;
    architecturalStyle?: string;
    divyaDesam?: number | null;
    tags?: string[];
  };
  established?: { period?: string; yearText?: string };
  governingBody?: string;
  website?: string;
  timings?: {
    darshan?: { label: string; from: string; to: string }[];
    pujaSchedule?: { time: string; name: string }[];
  };
  heroImage?: OldImageRef;
  atAGlance?: { icon: string; label: string; value: string }[];
  sections?: Record<string, OldSection>;
  worshipSOP?: {
    steps?: { title: string; points: string[] }[];
    entryGuidelines?: string[];
    specialRituals?: { ritual: string; description: string; howToBook: string }[];
    restrictions?: string[];
    spiritualOutcomes?: string[];
  };
  festivals?: { name: string; month: string; duration?: string; description?: string; major?: boolean }[];
  visitingInfo?: {
    bestTime?: string;
    dressCode?: string;
    howToReach?: { air?: string; rail?: string; road?: string };
    facilities?: string[];
    entryFee?: string;
    nearbyAttractions?: string[];
  };
  lamp?: { enabled: boolean; lampsToday: number };
  gallery?: OldImageRef[];
  nearbyTemples?: { name: string; distanceKm: number; slug?: string }[];
  reviews?: { author: string; rating: number; date: string; text: string }[];
  contact?: { phone?: string; email?: string; address?: string };
  references?: { id: number; title: string; publisher?: string; url?: string; accessed?: string }[];
  stub?: boolean;
  submittedBy?: string;
  rejectionReason?: string;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const pad = (n: number, width = 3) => String(n).padStart(width, "0");
const text = (s: string | undefined) => (s && s.trim() ? s.trim() : undefined);
const paras = (section: OldSection | undefined) =>
  (section?.paragraphs ?? []).map((p) => p.trim()).filter(Boolean).join("\n\n");

/** The old data uses "Shaivite"/"Vaishnavite"; 11_Lookups uses "Shaiva"/"Vaishnava". */
function normalizeTradition(value: string | undefined): TempleTradition | "" {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v.startsWith("shaiv")) return "Shaiva";
  if (v.startsWith("vaishnav")) return "Vaishnava";
  if (v.startsWith("shakt")) return "Shakta";
  if (v.startsWith("smart")) return "Smarta";
  if (v.startsWith("ganapat")) return "Ganapatya";
  if (v.includes("murugan") || v.startsWith("kaumar")) return "Kaumara/Murugan";
  return "Other";
}

function sourceTypeFor(url: string | undefined): SourceRecord["sourceType"] {
  if (!url) return "other";
  if (/\.gov\.in|nic\.in|\.gov\b/i.test(url)) return "government";
  if (/wikipedia|wikimedia|commons\./i.test(url)) return "media repository";
  return "other";
}

/** "Approx. 12 km from the station" -> 12 */
function kmFrom(value: string | undefined): number | undefined {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*km/i);
  return match ? Number(match[1]) : undefined;
}

/** TPL-IN-<STATE>-<CITY>-NNNN, stable for a given slug. */
function templeIdFor(old: OldTemple, ordinal: number): string {
  const letters = (value: string) => value.replace(/[^a-zA-Z ]/g, "").trim();
  /** "Tamil Nadu" -> TN, "Kerala" -> KE — matches the workbook's TPL-IN-TN-CUD form. */
  const stateCode = (value: string) => {
    const words = letters(value).split(/\s+/).filter(Boolean);
    const code = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 2);
    return (code || "XX").toUpperCase().slice(0, 3);
  };
  const cityCode = (value: string) => (letters(value).replace(/\s+/g, "").slice(0, 3) || "XXX").toUpperCase();
  const country = old.location.country?.toLowerCase() === "india" ? "IN" : (letters(old.location.country ?? "").slice(0, 2) || "XX").toUpperCase();
  return `TPL-${country}-${stateCode(old.location.state ?? "")}-${cityCode(old.location.city ?? "")}-${pad(ordinal, 4)}`;
}

/* ------------------------------------------------------------------ *
 * Migration
 * ------------------------------------------------------------------ */

function migrate(old: OldTemple, ordinal: number): { temple: Temple; notes: string[] } {
  const notes: string[] = [];
  const t = blankTemple();
  const published = old.status === "published";

  t.templeId = templeIdFor(old, ordinal);
  t.slug = old.slug;
  t.status = old.status;
  if (old.submittedBy) t.submittedBy = old.submittedBy;
  if (old.rejectionReason) t.rejectionReason = old.rejectionReason;

  /* ---- sources first: everything else cites them ---- */
  const sourceIdByOldId = new Map<number, string>();
  t.sources = (old.references ?? []).map((ref, index) => {
    const sourceId = `SRC${pad(index + 1)}`;
    sourceIdByOldId.set(ref.id, sourceId);
    const record: SourceRecord = {
      sourceId,
      sourceType: sourceTypeFor(ref.url),
      title: ref.title,
      publisherOrAuthority: text(ref.publisher),
      url: text(ref.url),
      accessDate: text(ref.accessed) ?? TODAY,
      claimScope: "Imported with the pre-2026 entry; scope not yet narrowed to specific claims.",
      adminApproved: published,
    };
    return record;
  });
  const citedIds = (section: OldSection | undefined): string[] =>
    (section?.citations ?? []).map((id) => sourceIdByOldId.get(id)).filter((v): v is string => Boolean(v));

  /* ---- identity ---- */
  t.identity.nameEn = old.name;
  t.identity.nameLocal = text(old.nameLocal?.text);
  t.identity.localLanguage = text(old.nameLocal?.script);
  t.identity.presidingDeity = old.deity?.presiding ?? "";
  t.identity.consortDeity = text(old.deity?.consort);
  t.identity.tradition = normalizeTradition(old.classification?.tradition);
  t.identity.templeType = old.classification?.templeType ?? "";
  t.identity.sacredClassifications = [
    ...(old.classification?.tags ?? []),
    ...(old.classification?.divyaDesam ? [`Divya Desam #${old.classification.divyaDesam}`] : []),
  ];
  // The old "religiousSignificance" section is the closest thing to the
  // schema's short significance line; the subtitle is a formatting artifact.
  t.identity.spiritualSignificanceShort =
    paras(old.sections?.religiousSignificance).split("\n\n")[0] ?? "";

  /* ---- location ---- */
  t.location.city = old.location.city ?? "";
  // district is Required in the dictionary; the old shape made it optional.
  t.location.district = old.location.district ?? old.location.city ?? "";
  if (!old.location.district) notes.push("district defaulted to city");
  t.location.stateProvince = old.location.state ?? "";
  t.location.country = old.location.country ?? "India";
  const address = text(old.contact?.address) ?? text(old.location.address);
  t.location.postalCode = address?.match(/\b\d{6}\b/)?.[0];
  if (old.location.coordinates && (old.location.coordinates.lat !== 0 || old.location.coordinates.lng !== 0)) {
    t.location.latitude = old.location.coordinates.lat;
    t.location.longitude = old.location.coordinates.lng;
  }

  /* ---- governance ---- */
  t.governance.establishedEra = [text(old.established?.period), text(old.established?.yearText)]
    .filter(Boolean)
    .join(" · ") || undefined;
  t.governance.managingAuthority = text(old.governingBody);
  t.governance.officialWebsite = text(old.website);
  t.governance.officialPhone = text(old.contact?.phone);
  t.governance.officialEmail = text(old.contact?.email);

  /* ---- narrative ---- */
  t.narrative.summaryIntro = paras(old.sections?.introduction);
  t.narrative.documentedHistory = paras(old.sections?.history);
  t.narrative.architectureStyle = text(old.classification?.architecturalStyle);
  // The old religiousSignificance is devotional, so it becomes sthala puranam —
  // the schema deliberately separates tradition from documented chronology.
  t.narrative.sthalaPuranam = paras(old.sections?.religiousSignificance) || undefined;

  t.editorial.overallVerificationStatus = published ? "partial" : "unverified";
  t.editorial.lastVerifiedDate = undefined;

  /* ---- 02 visiting info ---- */
  const guidelines = [
    ...(old.worshipSOP?.entryGuidelines ?? []).map((g) => `• ${g}`),
    ...(old.worshipSOP?.restrictions ?? []).map((r) => `• ${r}`),
  ];
  t.visitingInfo = {
    sourceIds: [],
    verificationStatus: "unverified",
    dressCode: text(old.visitingInfo?.dressCode),
    entryRules: guidelines.length ? guidelines.join("\n") : undefined,
    nearestRailStation: text(old.visitingInfo?.howToReach?.rail),
    railDistanceKm: kmFrom(old.visitingInfo?.howToReach?.rail),
    nearestBusStation: text(old.visitingInfo?.howToReach?.road),
    busDistanceKm: kmFrom(old.visitingInfo?.howToReach?.road),
    nearestAirport: text(old.visitingInfo?.howToReach?.air),
    airportDistanceKm: kmFrom(old.visitingInfo?.howToReach?.air),
  };

  /* ---- 03 opening hours ---- */
  t.openingHours = (old.timings?.darshan ?? []).map((row, index) => ({
    hoursId: `HRS${pad(index + 1)}`,
    dayType: "daily" as const,
    sessionName: row.label,
    openTime: row.from,
    closeTime: row.to,
    closedFlag: false,
    sourceIds: [],
    verificationStatus: "needs recheck" as VerificationStatus,
  }));

  /* ---- 04 worship SOP ---- */
  t.worshipSop = (old.worshipSOP?.steps ?? []).map((step, index) => ({
    sopStepId: `SOP${pad(index + 1)}`,
    stepNumber: index + 1,
    stepTitle: step.title,
    instruction: (step.points ?? []).join("\n"),
    linkedShrineIds: [],
    linkedMediaIds: [],
    sourceIds: [],
    // Imported instructions have no attached authority, so they stay unpublished
    // until someone sources them. This is the editorial rule, not a defect.
    verificationStatus: "draft" as VerificationStatus,
  }));
  if (t.worshipSop.length) notes.push(`${t.worshipSop.length} SOP steps imported as "draft" (unsourced)`);

  /* ---- 05 shrines: the old deity.others are the only shrine-ish data ---- */
  t.shrines = (old.deity?.others ?? []).map((name, index) => ({
    shrineId: `SHR${pad(index + 1)}`,
    shrineName: name,
    deityOrSubject: name,
    spaceType: "shrine" as const,
    linkedMediaIds: [],
    sourceIds: [],
    verificationStatus: "unverified" as VerificationStatus,
  }));

  /* ---- 06 poojas and sevas ---- */
  const poojas: Temple["poojas"] = (old.timings?.pujaSchedule ?? []).map((row, index) => ({
    poojaId: `PUJ${pad(index + 1)}`,
    recordType: "pooja" as const,
    nameEn: row.name,
    startTime: row.time,
    recurrence: "Daily",
    linkedMediaIds: [],
    sourceIds: [],
    verificationStatus: "needs recheck" as VerificationStatus,
  }));
  (old.worshipSOP?.specialRituals ?? []).forEach((ritual, index) => {
    poojas.push({
      poojaId: `SEV${pad(index + 1)}`,
      recordType: "seva",
      nameEn: ritual.ritual,
      description: text(ritual.description),
      bookingMethod: text(ritual.howToBook),
      linkedMediaIds: [],
      sourceIds: [],
      verificationStatus: "needs recheck",
    });
  });
  t.poojas = poojas;

  /* ---- 07 festivals ---- */
  t.festivals = (old.festivals ?? []).map((festival, index) => ({
    festivalId: `FES${pad(index + 1)}`,
    festivalNameEn: festival.name,
    tamilOrLocalMonth: text(festival.month),
    duration: text(festival.duration),
    significance: festival.description ?? "",
    linkedMediaIds: [],
    sourceIds: [],
    verificationStatus: "needs recheck" as VerificationStatus,
  }));

  /* ---- 08 media ---- */
  const media: MediaItem[] = [];
  const asMedia = (
    image: OldImageRef,
    id: string,
    category: MediaItem["category"],
    title: string
  ): MediaItem => ({
    mediaId: id,
    mediaType: "image",
    category,
    title,
    caption: image.caption ?? image.alt,
    altText: image.alt,
    fileOrUrl: image.src,
    creator: text(image.credit?.author),
    license: image.credit?.license ?? "",
    attributionText: [image.credit?.author, image.credit?.license].filter(Boolean).join(" · "),
    sourceUrl: text(image.credit?.sourceUrl),
    editorialApproved: published,
    verificationStatus: published ? "approved" : "pending",
  });
  if (old.heroImage?.src) media.push(asMedia(old.heroImage, "MED001", "hero", `${old.name} — hero image`));
  (old.gallery ?? []).forEach((image, index) => {
    media.push(asMedia(image, `MED${pad(media.length + 1)}`, "architecture", image.caption ?? `Gallery image ${index + 1}`));
  });
  t.media = media;

  // The old per-section `citations` have no per-field column in the schema:
  // a source states what it supports through its own claim_scope instead.
  // They are therefore not re-homed, and no provenance is invented for them.
  void citedIds;

  /* ---- extensions: everything the workbook has no column for ---- */
  t.extensions = {
    lamp: old.lamp ?? { enabled: false, lampsToday: 0 },
    otherDeities: old.deity?.others ?? [],
    address,
    majorFestivalIds: (old.festivals ?? [])
      .map((festival, index) => (festival.major ? `FES${pad(index + 1)}` : ""))
      .filter(Boolean),
    nearbyTemples: old.nearbyTemples ?? [],
    reviews: old.reviews ?? [],
    architectureNotes: paras(old.sections?.architecture) || undefined,
    administrationNotes: paras(old.sections?.administration) || undefined,
    donationsNotes: paras(old.sections?.donationsAndServices) || undefined,
    spiritualOutcomes: old.worshipSOP?.spiritualOutcomes ?? [],
    bestTime: text(old.visitingInfo?.bestTime),
    entryFee: text(old.visitingInfo?.entryFee),
    facilities: old.visitingInfo?.facilities ?? [],
  };

  return { temple: t, notes };
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
let migrated = 0;
let skipped = 0;

files.forEach((file, index) => {
  const full = path.join(DATA_DIR, file);
  const raw = JSON.parse(fs.readFileSync(full, "utf8")) as OldTemple & { templeId?: string };
  if (raw.templeId && (raw as unknown as Temple).identity) {
    console.log(`  = ${file} already migrated`);
    skipped += 1;
    return;
  }
  const { temple, notes } = migrate(raw, index + 1);
  if (!DRY) fs.writeFileSync(full, JSON.stringify(temple, null, 2) + "\n", "utf8");
  migrated += 1;
  const counts = `hours:${temple.openingHours.length} sop:${temple.worshipSop.length} poojas:${temple.poojas.length} fest:${temple.festivals.length} media:${temple.media.length} src:${temple.sources.length}`;
  console.log(`  ${DRY ? "~" : "+"} ${file.padEnd(38)} ${temple.templeId}  ${counts}${notes.length ? `  [${notes.join("; ")}]` : ""}`);
});

console.log(`\n${DRY ? "DRY RUN — nothing written. " : ""}${migrated} migrated, ${skipped} already current.`);
