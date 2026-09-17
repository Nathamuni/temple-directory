import type { MetadataRoute } from "next";
import { getPublishedTemples, getFacetValues, type Facet } from "@/lib/temples";

const BASE = "https://temples.example.org"; // set the production domain here

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const facets: Facet[] = ["deity", "state", "type", "tradition"];
  return [
    { url: `${BASE}/` },
    ...getPublishedTemples().map((t) => ({ url: `${BASE}/temple/${t.slug}` })),
    ...facets.flatMap((f) =>
      getFacetValues(f).map((v) => ({ url: `${BASE}/browse/${f}/${v.slug}` }))
    ),
  ];
}
