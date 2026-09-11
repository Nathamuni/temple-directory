import fs from "fs";
import path from "path";
import type { Temple } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "temples");

function fail(slug: string, message: string): never {
  throw new Error(`Temple data error [${slug}]: ${message}`);
}

function validate(temple: Temple, file: string): Temple {
  const slug = temple.slug ?? file;
  const STATUSES = ["draft", "pending", "verified", "published"];
  if (!STATUSES.includes(temple.status)) {
    fail(slug, `status must be one of ${STATUSES.join(" | ")} (found "${temple.status}")`);
  }
  const required: [string, unknown][] = [
    ["slug", temple.slug],
    ["name", temple.name],
    ["subtitle", temple.subtitle],
    ["deity.presiding", temple.deity?.presiding],
    ["location.city", temple.location?.city],
    ["location.state", temple.location?.state],
    ["location.country", temple.location?.country],
    ["location.coordinates", temple.location?.coordinates],
    ["classification.templeType", temple.classification?.templeType],
    ["established.period", temple.established?.period],
    ["governingBody", temple.governingBody],
    ["heroImage.src", temple.heroImage?.src],
    ["heroImage.credit", temple.heroImage?.credit],
    ["sections.introduction", temple.sections?.introduction],
    ["references", temple.references],
  ];
  for (const [field, value] of required) {
    if (value === undefined || value === null || value === "") {
      fail(slug, `missing mandatory field "${field}"`);
    }
  }
  if (!Array.isArray(temple.references) || temple.references.length < 2) {
    fail(slug, `at least 2 references are mandatory (found ${temple.references?.length ?? 0})`);
  }
  if (!temple.stub && temple.worshipSOP?.steps?.length !== 6) {
    fail(
      slug,
      `worshipSOP.steps must have exactly 6 steps (found ${temple.worshipSOP?.steps?.length ?? 0})`
    );
  }
  return temple;
}

let cache: Temple[] | null = null;

export function getAllTemples(): Temple[] {
  if (cache) return cache;
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  cache = files.map((file) => {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
    let parsed: Temple;
    try {
      parsed = JSON.parse(raw) as Temple;
    } catch (e) {
      fail(file, `invalid JSON — ${(e as Error).message}`);
    }
    return validate(parsed, file);
  });
  return cache;
}

export function getTemple(slug: string): Temple | undefined {
  return getAllTemples().find((t) => t.slug === slug);
}

export type Facet = "deity" | "state" | "type" | "tradition";

export const FACET_LABELS: Record<Facet, string> = {
  deity: "Deity",
  state: "State",
  type: "Temple Type",
  tradition: "Tradition",
};

export function facetValue(temple: Temple, facet: Facet): string {
  switch (facet) {
    case "deity":
      return temple.deity.presiding;
    case "state":
      return temple.location.state;
    case "type":
      return temple.classification.templeType;
    case "tradition":
      return temple.classification.tradition;
  }
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getFacetValues(facet: Facet): { value: string; slug: string; count: number }[] {
  const map = new Map<string, { value: string; count: number }>();
  for (const t of getAllTemples()) {
    const value = facetValue(t, facet);
    const key = slugify(value);
    const entry = map.get(key);
    if (entry) entry.count += 1;
    else map.set(key, { value, count: 1 });
  }
  return [...map.entries()]
    .map(([slug, { value, count }]) => ({ value, slug, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

export function getTemplesByFacet(facet: Facet, valueSlug: string): Temple[] {
  return getAllTemples().filter((t) => slugify(facetValue(t, facet)) === valueSlug);
}
