import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedTemples, getTemple } from "@/lib/temples";
import { getSession } from "@/lib/session";
import { IS_STATIC } from "@/lib/staticMode";
import { templeJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { heroImage, subtitle } from "@/lib/temple-view";

import Hero from "@/components/temple/Hero";
import SectionNav from "@/components/temple/SectionNav";
import AtAGlance from "@/components/temple/AtAGlance";
import SacredSignificance from "@/components/temple/SacredSignificance";
import HistoryTradition from "@/components/temple/HistoryTradition";
import WorshipSop from "@/components/temple/WorshipSop";
import PoojaSchedule from "@/components/temple/PoojaSchedule";
import TempleLayout from "@/components/temple/TempleLayout";
import ArchitectureGallery from "@/components/temple/ArchitectureGallery";
import Festivals from "@/components/temple/Festivals";
import PlanYourVisit from "@/components/temple/PlanYourVisit";
import ReferencesSection from "@/components/temple/ReferencesSection";
import NearbyTemples from "@/components/temple/NearbyTemples";
import Section from "@/components/temple/Section";
import DataConfidence from "@/components/temple/sidebar/DataConfidence";
import QuickCorrection from "@/components/temple/sidebar/QuickCorrection";

export function generateStaticParams() {
  return getPublishedTemples().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const temple = getTemple(slug);
  if (!temple) return {};
  const hero = heroImage(temple);
  return {
    title: temple.identity.nameEn,
    description:
      temple.identity.spiritualSignificanceShort?.slice(0, 200) ||
      temple.narrative.summaryIntro.slice(0, 200) ||
      subtitle(temple),
    openGraph: {
      title: temple.identity.nameEn,
      images: hero ? [hero.fileOrUrl] : [],
    },
  };
}

/**
 * JSON-LD is injected as raw HTML, so close any tag sequence that could break
 * out of the script element. Without this a value containing "</script>" would
 * be a stored-XSS vector.
 */
function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function TemplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const temple = getTemple(slug);
  if (!temple) notFound();

  // Unpublished entries are a preview for the owner and admins only. A static
  // export has no session to check and builds only published slugs, so an
  // unpublished entry is simply absent there.
  if (temple.status !== "published") {
    if (IS_STATIC) notFound();
    const session = await getSession();
    const mayPreview =
      session && (session.role === "admin" || session.username === temple.submittedBy);
    if (!mayPreview) notFound();
  }

  const hasLayout = temple.shrines.length > 0 || temple.media.some((m) => m.category === "map");
  const hasArchitecture =
    Boolean(temple.narrative.architectureStyle) ||
    temple.media.some((m) => m.editorialApproved && m.category !== "hero" && m.category !== "map");
  const hasSchedule = temple.poojas.length > 0 || temple.openingHours.length > 0;

  const nav = [
    { id: "glance", title: "At a glance" },
    { id: "significance", title: "Sacred significance" },
    { id: "history", title: "History & tradition" },
    { id: "worship", title: "How to worship" },
    ...(hasSchedule ? [{ id: "schedule", title: "Daily worship" }] : []),
    ...(hasLayout ? [{ id: "layout", title: "Temple layout" }] : []),
    ...(hasArchitecture ? [{ id: "architecture", title: "Architecture" }] : []),
    ...(temple.festivals.length ? [{ id: "festivals", title: "Festivals" }] : []),
    { id: "visit", title: "Plan your visit" },
    ...(temple.extensions.nearbyTemples.length ? [{ id: "nearby", title: "Nearby temples" }] : []),
    { id: "sources", title: "References" },
  ];

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(templeJsonLd(temple)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(temple)) }}
      />

      {temple.status !== "published" && (
        <div className="mx-auto max-w-[1440px] px-3 pt-4 sm:px-6">
          <div className="alert">
            <span aria-hidden>👁</span>
            <div>
              <b>Preview only.</b> This entry is <b>{temple.status}</b> and is not visible to the
              public.
              {temple.rejectionReason && <> Reviewer note: {temple.rejectionReason}</>}
            </div>
          </div>
        </div>
      )}

      <Hero temple={temple} />

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-3 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <SectionNav items={nav} />

        <div className="min-w-0">
          <AtAGlance temple={temple} />
          <SacredSignificance temple={temple} />
          <HistoryTradition temple={temple} />
          <WorshipSop temple={temple} />
          {hasSchedule && <PoojaSchedule temple={temple} />}
          {hasLayout && <TempleLayout temple={temple} />}
          {hasArchitecture && <ArchitectureGallery temple={temple} />}
          <Festivals temple={temple} />
          <PlanYourVisit temple={temple} />

          {temple.extensions.nearbyTemples.length > 0 && (
            <Section id="nearby" kicker="Continue the pilgrimage" title="Nearby temples">
              <NearbyTemples nearby={temple.extensions.nearbyTemples} />
            </Section>
          )}

          <ReferencesSection temple={temple} />
        </div>

        <aside className="max-h-max xl:sticky xl:top-[78px]">
          <DataConfidence temple={temple} />
          <QuickCorrection temple={temple} />
        </aside>
      </div>
    </article>
  );
}
