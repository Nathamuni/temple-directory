import type { Temple } from "./types";

export function templeJsonLd(temple: Temple) {
  return {
    "@context": "https://schema.org",
    "@type": "HinduTemple",
    name: temple.name,
    alternateName: temple.nameLocal?.text,
    description: temple.sections.introduction.paragraphs[0],
    url: temple.website,
    image: temple.heroImage.src,
    address: {
      "@type": "PostalAddress",
      addressLocality: temple.location.city,
      addressRegion: temple.location.state,
      addressCountry: temple.location.country,
      streetAddress: temple.location.address,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: temple.location.coordinates.lat,
      longitude: temple.location.coordinates.lng,
    },
  };
}

export function breadcrumbJsonLd(temple: Temple) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Temple Directory", item: "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: temple.location.state,
        item: `/browse/state/${temple.location.state.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      },
      { "@type": "ListItem", position: 3, name: temple.name },
    ],
  };
}
