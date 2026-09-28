import fs from "fs";
import path from "path";
import type { MantraRecord, Temple } from "./types";

/**
 * Prayers & slokas.
 *
 * Two kinds, deliberately kept apart:
 *
 *  - General slokas (this file's library): the same text wherever a deity is
 *    worshipped, stored once in data/mantra-library.json and matched to a
 *    temple by its presiding deity or sacred group (e.g. Jyotirlinga). Shown
 *    publicly, always labelled as not yet confirmed by the temple.
 *  - Temple-specific hymns (Temple.mantras, sheet 13_Mantras): shown only once
 *    the temple's priest has verified them.
 *
 * The library ships with the code (it is reference text, not user data), so
 * it is read from the repo's data/ directory, never from DATA_DIR.
 */

export type DeityKey =
  | "ganesha"
  | "shiva"
  | "vishnu"
  | "narasimha"
  | "krishna"
  | "rama"
  | "devi"
  | "lakshmi"
  | "murugan"
  | "ayyappan"
  | "surya"
  | "river"
  | "brahma"
  | "sai";

export const DEITY_LABEL: Record<DeityKey, string> = {
  ganesha: "Ganesha",
  shiva: "Shiva",
  vishnu: "Vishnu",
  narasimha: "Narasimha",
  krishna: "Krishna",
  rama: "Rama",
  devi: "Devi",
  lakshmi: "Lakshmi",
  murugan: "Murugan",
  ayyappan: "Ayyappan",
  surya: "Surya",
  river: "the sacred rivers",
  brahma: "Brahma",
  sai: "Sai Baba",
};

/**
 * presidingDeity is free text ("Nataraja (Shiva)", "Bhavani (Devi)", …), so it
 * is matched by keyword. Order matters only for the display label: the first
 * match names the "Traditional slokas for …" heading.
 */
const DEITY_PATTERNS: [DeityKey[], RegExp][] = [
  [["narasimha", "vishnu"], /narasimha/],
  [["lakshmi", "devi"], /lakshmi|laxmi/],
  [["shiva"], /shiva|siva|nataraja|baidyanath|vaidyanath|mahadev|linga/],
  [["krishna"], /krishna/],
  [["rama"], /\brama?\b|ram lalla/],
  [["vishnu"], /vishnu|narayana|venkateswara|ranganatha|jagannath/],
  [["murugan"], /murugan|subramanya|subrahmanya|kartikeya|skanda/],
  [["ganesha"], /ganesha|ganapati|vinayaka/],
  [["ayyappan"], /ayyappa/],
  [["surya"], /surya/],
  [["river"], /ganga|yamuna/],
  [["brahma"], /brahma/],
  [["sai"], /sai baba/],
  [["devi"], /devi|durga|kali|bhavatarini|\btara\b|bhavani|bhagavathy|rajarajeswari|sharda|naina|kamakshi|meenakshi|amman/],
];

export function deityKeys(temple: Pick<Temple, "identity">): DeityKey[] {
  const text = temple.identity.presidingDeity.toLowerCase();
  const keys: DeityKey[] = [];
  for (const [matched, pattern] of DEITY_PATTERNS) {
    if (pattern.test(text)) for (const key of matched) if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

export interface LibrarySloka {
  mantraId: string;
  title: string;
  appliesTo: {
    /** Shown on every temple (the Ganesha invocation). */
    all?: boolean;
    deities?: DeityKey[];
    /** Case-insensitive substring match against sacredClassifications. */
    classifications?: string[];
  };
  group: string;
  textOriginal: string;
  script: string;
  transliteration: string;
  meaning: string;
  sourceText: string;
  sourceUrl: string;
  checkUrl?: string;
  whenChanted?: string;
  repetitions?: number;
  restriction: "public" | "name_only";
  /** Who compared the text against its source, and when. */
  checkedBy: string;
  checkedDate: string;
  notes?: string;
}

const LIBRARY_FILE = path.join(process.cwd(), "data", "mantra-library.json");

let cache: { stamp: number; items: LibrarySloka[] } | null = null;

export function mantraLibrary(): LibrarySloka[] {
  const stamp = fs.existsSync(LIBRARY_FILE) ? fs.statSync(LIBRARY_FILE).mtimeMs : 0;
  if (cache && cache.stamp === stamp) return cache.items;
  const items = stamp ? (JSON.parse(fs.readFileSync(LIBRARY_FILE, "utf8")) as LibrarySloka[]) : [];
  cache = { stamp, items };
  return items;
}

function classificationMatch(temple: Pick<Temple, "identity">, wanted: string[]): boolean {
  const tags = temple.identity.sacredClassifications.map((c) => c.toLowerCase());
  return wanted.some((w) => tags.some((t) => t.includes(w.toLowerCase())));
}

/**
 * General slokas for a temple, in the order they are recited: the Ganesha
 * invocation first, then the temple's own sacred group, then its deity.
 */
export function librarySlokasFor(temple: Pick<Temple, "identity">): LibrarySloka[] {
  const keys = deityKeys(temple);
  const rank = (s: LibrarySloka) =>
    s.appliesTo.all ? 0 : s.appliesTo.classifications && classificationMatch(temple, s.appliesTo.classifications) ? 1 : 2;
  return mantraLibrary()
    .filter((s) => s.restriction === "public")
    .filter(
      (s) =>
        s.appliesTo.all ||
        s.appliesTo.deities?.some((d) => keys.includes(d)) ||
        (s.appliesTo.classifications && classificationMatch(temple, s.appliesTo.classifications))
    )
    .sort((a, b) => rank(a) - rank(b));
}

/** The label for "Traditional slokas for …": the temple's first-matched deity. */
export function deityLabel(temple: Pick<Temple, "identity">): string {
  const key = deityKeys(temple)[0];
  return key ? DEITY_LABEL[key] : temple.identity.presidingDeity;
}

/** A temple-specific hymn as the public may see it. */
export type PublicMantra = MantraRecord & { textHidden: boolean };

/**
 * Temple-specific hymns cleared for the public: only authority-verified rows,
 * and a name_only row never carries its text out of this function.
 */
export function publicTempleMantras(temple: Pick<Temple, "mantras">): PublicMantra[] {
  return temple.mantras
    .filter((m) => m.verificationStatus === "authority-verified")
    .map((m) =>
      m.restriction === "name_only"
        ? { ...m, textOriginal: undefined, transliteration: undefined, meaning: m.meaning, textHidden: true }
        : { ...m, textHidden: false }
    );
}

/** How many temple-specific hymns are still waiting on the priest. */
export function pendingTempleMantraCount(temple: Pick<Temple, "mantras">): number {
  return temple.mantras.filter((m) => m.verificationStatus !== "authority-verified").length;
}

/** HTML lang for a script, so screen readers and fonts pick the right language. */
export function langForScript(script: string | undefined): string | undefined {
  switch (script) {
    case "Devanagari":
      return "sa";
    case "Tamil":
      return "ta";
    case "Telugu":
      return "te";
    case "Kannada":
      return "kn";
    case "Malayalam":
      return "ml";
    case "Bengali":
      return "bn";
    case "Gujarati":
      return "gu";
    case "Odia":
      return "or";
    default:
      return undefined;
  }
}
