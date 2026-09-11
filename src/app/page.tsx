import Link from "next/link";
import { getAllTemples, getFacetValues, FACET_LABELS, type Facet } from "@/lib/temples";
import TempleCard from "@/components/home/TempleCard";
import SearchLite from "@/components/home/SearchLite";

export default function HomePage() {
  const temples = getAllTemples();
  const totalLamps = temples.reduce((sum, t) => sum + (t.lamp?.lampsToday ?? 0), 0);
  const facets: Facet[] = ["deity", "state", "type", "tradition"];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <section className="text-center">
        <h1 className="text-3xl">Temple Directory</h1>
        <p className="mt-1 text-[var(--ink-soft)]">
          A structured, cited encyclopedia of Hindu temples — with verified worship guides and
          Akhand Deepam lamp sponsorship.
        </p>
        <p className="ui mt-3 text-sm text-[var(--accent)]">
          🪔 {totalLamps} lamps burning across {temples.length} temples today
        </p>
        <div className="mt-5">
          <SearchLite
            entries={temples.map((t) => ({
              slug: t.slug,
              name: t.name,
              city: t.location.city,
              state: t.location.state,
              deity: t.deity.presiding,
            }))}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="wiki-h2">Browse the Directory</h2>
        <div className="space-y-2">
          {facets.map((facet) => (
            <div key={facet} className="flex flex-wrap items-baseline gap-2">
              <span className="ui w-28 shrink-0 text-sm font-semibold text-[var(--ink-soft)]">
                By {FACET_LABELS[facet]}
              </span>
              {getFacetValues(facet).map((v) => (
                <Link
                  key={v.slug}
                  href={`/browse/${facet}/${v.slug}`}
                  className="ui border border-[var(--line-soft)] px-2.5 py-1 text-sm hover:bg-[var(--paper-soft)]"
                >
                  {v.value} <span className="text-[var(--ink-soft)]">({v.count})</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="wiki-h2">Temples</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {temples.map((t) => (
            <TempleCard key={t.slug} temple={t} />
          ))}
        </div>
      </section>
    </div>
  );
}
