import Link from "next/link";
import { getPublishedTemples, getFacetValues, FACET_LABELS, type Facet } from "@/lib/temples";
import TempleCard from "@/components/home/TempleCard";
import SearchLite from "@/components/home/SearchLite";

export default function HomePage() {
  const temples = getPublishedTemples();
  const facets: Facet[] = ["deity", "state", "type", "tradition"];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <section className="text-center">
        <h1 className="text-3xl">Temple Directory</h1>
        <p className="mt-1 text-muted">
          A structured, sourced encyclopedia of Hindu temples — sacred significance, temple-specific
          worship guidance, and the evidence behind every claim.
        </p>
        <p className="mt-3 text-sm text-saffron">
          {temples.length} temples published · every claim carries its source
        </p>
        <div className="mt-5">
          <SearchLite
            entries={temples.map((t) => ({
              slug: t.slug,
              name: t.identity.nameEn,
              city: t.location.city,
              state: t.location.stateProvince,
              deity: t.identity.presidingDeity,
            }))}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display mt-0 mb-3 border-b border-line pb-1 text-2xl font-normal">Browse the Directory</h2>
        <div className="space-y-2">
          {facets.map((facet) => (
            <div key={facet} className="flex flex-wrap items-baseline gap-2">
              <span className="w-28 shrink-0 text-sm font-semibold text-muted">
                By {FACET_LABELS[facet]}
              </span>
              {getFacetValues(facet).map((v) => (
                <Link
                  key={v.slug}
                  href={`/browse/${facet}/${v.slug}`}
                  className="border border-[var(--line-soft)] px-2.5 py-1 text-sm hover:bg-[var(--paper-soft)]"
                >
                  {v.value} <span className="text-muted">({v.count})</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display mt-0 mb-3 border-b border-line pb-1 text-2xl font-normal">Temples</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {temples.map((t) => (
            <TempleCard key={t.slug} temple={t} />
          ))}
        </div>
      </section>
    </div>
  );
}
