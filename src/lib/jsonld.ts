import type { Temple } from "./types";
import { heroImage, subtitle } from "./temple-view";

/**
 * JSON-LD is injected into the page as a script tag, so every value here must
 * be data the site controls. JSON.stringify escaping is not enough on its own;
 * the page escapes `<` before injection (see the temple page).
 */
export function templeJsonLd(temple: Temple) {
  const hero = heroImage(temple);
  const geo =
    temple.location.latitude !== undefined && temple.location.longitude !== undefined
      ? {
          "@type": "GeoCoordinates",
          latitude: temple.location.latitude,
          longitude: temple.location.longitude,
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "HinduTemple",
    name: temple.identity.nameEn,
    alternateName: temple.identity.nameLocal,
    description: temple.narrative.summaryIntro.split("\n\n")[0] || subtitle(temple),
    url: temple.governance.officialWebsite || undefined,
    image: hero?.fileOrUrl,
    telephone: temple.governance.officialPhone || undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: temple.location.city,
      addressRegion: temple.location.stateProvince,
      addressCountry: temple.location.country,
      postalCode: temple.location.postalCode,
      streetAddress: temple.extensions.address,
    },
    geo,
  };
}

export function breadcrumbJsonLd(temple: Temple) {
  const state = temple.location.stateProvince;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Temple Directory", item: "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: state,
        item: `/browse/state/${state.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      },
      { "@type": "ListItem", position: 3, name: temple.identity.nameEn },
    ],
  };
}
