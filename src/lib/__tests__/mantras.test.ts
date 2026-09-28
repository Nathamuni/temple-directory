import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { useTempDataDir } from "./helpers";

useTempDataDir();
const { getAllTemples, getTemple } = await import("../temples");
const { deityKeys, librarySlokasFor, mantraLibrary, publicTempleMantras, pendingTempleMantraCount } = await import("../mantras");
const { changedAreas } = await import("../fieldAuthority");
const { proposeRevision, reviewRevision, RevisionError } = await import("../store/revisions");
const { validateTemple } = await import("../validate");
import type { MantraRecord, Temple } from "../types";

const SLUG = "srirangam-ranganathaswamy";

function mantra(over: Partial<MantraRecord> = {}): MantraRecord {
  return {
    mantraId: "MAN001",
    title: "Test hymn",
    textOriginal: "॥ test ॥",
    script: "Devanagari",
    transliteration: "test",
    meaning: "A test.",
    sourceText: "Test source",
    linkedShrineIds: [],
    sourceIds: ["SRC001"],
    verificationStatus: "sourced",
    restriction: "public",
    ...over,
  };
}

function withMantras(slug: string, mantras: MantraRecord[]): Temple {
  const t = structuredClone(getTemple(slug)!);
  t.mantras = mantras;
  return t;
}

describe("deity matching", () => {
  it("maps every temple in the directory to at least one deity", () => {
    const unmapped = getAllTemples().filter((t) => deityKeys(t).length === 0).map((t) => t.identity.presidingDeity);
    expect(unmapped).toEqual([]);
  });

  it("maps compound and alias names", () => {
    const k = (presidingDeity: string) => deityKeys({ identity: { presidingDeity, sacredClassifications: [] } } as never);
    expect(k("Nataraja (Shiva)")).toContain("shiva");
    expect(k("Narasimha (Vishnu)")).toEqual(expect.arrayContaining(["narasimha", "vishnu"]));
    expect(k("Bhavani (Devi)")).toContain("devi");
    expect(k("Subramanya")).toContain("murugan");
    expect(k("Rama (as Ram Lalla)")).toContain("rama");
    expect(k("Mahalakshmi")).toEqual(expect.arrayContaining(["lakshmi", "devi"]));
  });
});

describe("general library", () => {
  const library = mantraLibrary();
  it("every entry is sourced and checked", () => {
    for (const s of library) {
      expect(s.sourceUrl, s.mantraId).toMatch(/^https?:\/\//);
      expect(s.textOriginal.trim(), s.mantraId).not.toBe("");
      expect(s.checkedBy, s.mantraId).not.toBe("");
    }
  });

  /**
   * Deities with no sourced library sloka yet. Brahma: the only fetched verse
   * (Matsya Purana 154.7) also praises Brahma as Rudra and was held back as
   * unsuitable for a card (research/2026-09-28-mantra-sources.md). Adding a
   * sourced Brahma sloka to the library should shrink this list to empty.
   */
  const KNOWN_GAPS = ["pushkar-brahma-temple"];

  it("gives every temple the Ganesha invocation first, and a deity sloka unless it is a declared gap", () => {
    for (const t of getAllTemples()) {
      const slokas = librarySlokasFor(t);
      expect(slokas[0]?.appliesTo.all, t.slug).toBe(true);
      // For a Ganesha temple the universal invocation IS its deity sloka.
      const isGanesha = deityKeys(t).includes("ganesha");
      const deitySlokas = slokas.filter((s) => !s.appliesTo.all || isGanesha);
      if (KNOWN_GAPS.includes(t.slug)) expect(deitySlokas, `${t.slug} gained a sloka — remove it from KNOWN_GAPS`).toHaveLength(0);
      else expect(deitySlokas.length, t.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives the Jyotirlinga verse to exactly the 12 Jyotirlinga temples", () => {
    const withVerse = getAllTemples().filter((t) => librarySlokasFor(t).some((s) => s.group === "Jyotirlinga"));
    expect(withVerse).toHaveLength(12);
    expect(withVerse.map((t) => t.slug)).toContain("kashi-vishwanath");
    expect(withVerse.map((t) => t.slug)).not.toContain(SLUG);
  });
});

describe("temple-specific mantras", () => {
  it("are hidden until authority-verified", () => {
    const t = withMantras(SLUG, [mantra(), mantra({ mantraId: "MAN002", verificationStatus: "verified" })]);
    expect(publicTempleMantras(t)).toHaveLength(0);
    expect(pendingTempleMantraCount(t)).toBe(2);
    const warnings = validateTemple(t).filter((i) => i.path.startsWith("mantras"));
    expect(warnings.some((w) => /stays hidden/.test(w.message))).toBe(true);
  });

  it("show once authority-verified", () => {
    const t = withMantras(SLUG, [mantra({ verificationStatus: "authority-verified" })]);
    expect(publicTempleMantras(t).map((m) => m.textOriginal)).toEqual(["॥ test ॥"]);
  });

  it("never expose the text of a name_only mantra", () => {
    const t = withMantras(SLUG, [mantra({ verificationStatus: "authority-verified", restriction: "name_only" })]);
    const [m] = publicTempleMantras(t);
    expect(m.textHidden).toBe(true);
    expect(m.textOriginal).toBeUndefined();
    expect(m.transliteration).toBeUndefined();
    expect(m.title).toBe("Test hymn");
  });

  it("flag rows with no title or duplicate ids as errors", () => {
    const t = withMantras(SLUG, [mantra({ title: "" }), mantra()]);
    const errors = validateTemple(t).filter((i) => i.level === "error" && i.path.startsWith("mantras"));
    expect(errors.map((e) => e.message).join(" ")).toMatch(/no title/);
    expect(errors.map((e) => e.message).join(" ")).toMatch(/used twice/);
  });
});

describe("priest authority over mantras", () => {
  it("detects a mantras change", () => {
    expect(changedAreas(getTemple(SLUG)!, withMantras(SLUG, [mantra()]))).toEqual(["mantras"]);
  });

  it("refuses temple management adding a mantra", () => {
    try {
      proposeRevision({ templeSlug: SLUG, actingRole: "temple_management", submittedBy: "tm", proposed: withMantras(SLUG, [mantra()]) });
      throw new Error("expected refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(RevisionError);
      expect((error as InstanceType<typeof RevisionError>).status).toBe(403);
    }
  });

  it("lets a priest add one, and approval makes it public as authority-verified", () => {
    const revision = proposeRevision({ templeSlug: SLUG, actingRole: "priest", submittedBy: "priestm", proposed: withMantras(SLUG, [mantra()]) });
    expect(publicTempleMantras(getTemple(SLUG)!)).toHaveLength(0);
    reviewRevision(revision.id, "approved", "admin");
    const live = publicTempleMantras(getTemple(SLUG)!);
    expect(live).toHaveLength(1);
    expect(live[0].verificationStatus).toBe("authority-verified");
    expect(live[0].verifiedBy).toEqual({ role: "priest", username: "priestm" });
  });

  it("does not stamp a contributor's mantra", () => {
    const other = "chidambaram-nataraja";
    const revision = proposeRevision({ templeSlug: other, actingRole: "contributor", submittedBy: "c", proposed: withMantras(other, [mantra()]), confirmedAreas: ["mantras"] });
    reviewRevision(revision.id, "approved", "admin");
    expect(publicTempleMantras(getTemple(other)!)).toHaveLength(0);
  });
});

it("library file is valid JSON in the repo", () => {
  const file = path.join(process.cwd(), "data", "mantra-library.json");
  expect(fs.existsSync(file)).toBe(true);
  expect(() => JSON.parse(fs.readFileSync(file, "utf8"))).not.toThrow();
});
