import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getFacetValues,
  getTemplesByFacet,
  FACET_LABELS,
  type Facet,
} from "@/lib/temples";
import TempleCard from "@/components/home/TempleCard";

const FACETS: Facet[] = ["deity", "state", "type", "tradition"];

export function generateStaticParams() {
  return FACETS.flatMap((facet) =>
    getFacetValues(facet).map((v) => ({ facet, value: v.slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ facet: string; value: string }>;
}): Promise<Metadata> {
  const { facet, value } = await params;
  const match = getFacetValues(facet as Facet).find((v) => v.slug === value);
  return { title: match ? `Temples — ${match.value}` : "Browse temples" };
}

export default async function BrowsePage({
  params,
}: {
  params: Promise<{ facet: string; value: string }>;
}) {
  const { facet, value } = await params;
  if (!FACETS.includes(facet as Facet)) notFound();
  const match = getFacetValues(facet as Facet).find((v) => v.slug === value);
  if (!match) notFound();
  const temples = getTemplesByFacet(facet as Facet, value);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <h1 className="text-2xl">
        Temples by {FACET_LABELS[facet as Facet]}: {match.value}
      </h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        {temples.length} {temples.length === 1 ? "entry" : "entries"} in the directory
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {temples.map((t) => (
          <TempleCard key={t.slug} temple={t} />
        ))}
      </div>
    </div>
  );
}
