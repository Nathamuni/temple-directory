import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllTemples, getTemple } from "@/lib/temples";
import { templeJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import TempleHero from "@/components/temple/TempleHero";
import Infobox from "@/components/temple/Infobox";
import AtAGlance from "@/components/temple/AtAGlance";
import TableOfContents from "@/components/temple/TableOfContents";
import WikiSection from "@/components/temple/WikiSection";
import WorshipSOP from "@/components/temple/WorshipSOP";
import FestivalCalendar from "@/components/temple/FestivalCalendar";
import LampWidget from "@/components/temple/LampWidget";
import Gallery from "@/components/temple/Gallery";
import VisitingInfo from "@/components/temple/VisitingInfo";
import NearbyTemples from "@/components/temple/NearbyTemples";
import Reviews from "@/components/temple/Reviews";
import References from "@/components/temple/References";

export function generateStaticParams() {
  return getAllTemples().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const temple = getTemple(slug);
  if (!temple) return {};
  return {
    title: temple.name,
    description: temple.sections.introduction.paragraphs[0]?.slice(0, 200),
    openGraph: { title: temple.name, images: [temple.heroImage.src] },
  };
}

export default async function TemplePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const temple = getTemple(slug);
  if (!temple) notFound();

  const full = !temple.stub;
  const s = temple.sections;

  const toc: { id: string; title: string }[] = [
    { id: "introduction", title: "Introduction" },
    ...(full
      ? [
          { id: "history", title: "History" },
          { id: "architecture", title: "Architecture" },
          { id: "significance", title: "Religious Significance" },
          { id: "visiting", title: "Visiting Information" },
          { id: "worship-sop", title: "Worship & Ritual Practices (SOP)" },
          { id: "festivals", title: "Festivals" },
          { id: "administration", title: "Administration" },
          { id: "donations", title: "Donations & Services" },
          ...(temple.lamp?.enabled ? [{ id: "light-a-lamp", title: "Light a Lamp (Akhand Deepam)" }] : []),
          ...(temple.gallery?.length ? [{ id: "gallery", title: "Gallery" }] : []),
          ...(temple.nearbyTemples?.length ? [{ id: "nearby", title: "Nearby Temples" }] : []),
          ...(temple.reviews?.length ? [{ id: "reviews", title: "Devotee Reviews" }] : []),
          { id: "contact", title: "Contact & Accessibility" },
        ]
      : [
          { id: "festivals", title: "Festivals" },
          ...(temple.nearbyTemples?.length ? [{ id: "nearby", title: "Nearby Temples" }] : []),
        ]),
    { id: "references", title: "References" },
  ];
  const num = (id: string) => toc.findIndex((t) => t.id === id) + 1;

  return (
    <article className="mx-auto max-w-[1100px] px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(templeJsonLd(temple)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(temple)) }}
      />

      {temple.stub && (
        <div className="ui mb-4 border border-[var(--line-soft)] bg-[var(--paper-soft)] px-3 py-2 text-xs text-[var(--ink-soft)]">
          This entry is a stub ({temple.status}) — the full standard template is applied once data
          collection and verification are complete.
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <TempleHero temple={temple} />
          <AtAGlance temple={temple} />
          <TableOfContents items={toc} />

          <WikiSection num={num("introduction")} id="introduction" title="Introduction" section={s.introduction} />

          {full && (
            <>
              <WikiSection num={num("history")} id="history" title="History" section={s.history} />
              <WikiSection num={num("architecture")} id="architecture" title="Architecture" section={s.architecture} />
              <WikiSection num={num("significance")} id="significance" title="Religious Significance" section={s.religiousSignificance} />
              <WikiSection num={num("visiting")} id="visiting" title="Visiting Information">
                <VisitingInfo info={temple.visitingInfo} timings={temple.timings} />
              </WikiSection>
              <WikiSection num={num("worship-sop")} id="worship-sop" title="Worship & Ritual Practices — SOP">
                <WorshipSOP sop={temple.worshipSOP} />
              </WikiSection>
            </>
          )}

          <WikiSection num={num("festivals")} id="festivals" title="Festivals">
            <FestivalCalendar festivals={temple.festivals} />
          </WikiSection>

          {full && (
            <>
              <WikiSection num={num("administration")} id="administration" title="Administration" section={s.administration} />
              <WikiSection num={num("donations")} id="donations" title="Donations & Services" section={s.donationsAndServices} />
              {temple.lamp?.enabled && (
                <WikiSection num={num("light-a-lamp")} id="light-a-lamp" title="Light a Lamp — Akhand Deepam">
                  <LampWidget templeName={temple.name} lampsToday={temple.lamp.lampsToday} />
                </WikiSection>
              )}
              {temple.gallery?.length > 0 && (
                <WikiSection num={num("gallery")} id="gallery" title="Gallery">
                  <Gallery images={temple.gallery} />
                </WikiSection>
              )}
            </>
          )}

          {temple.nearbyTemples?.length > 0 && (
            <WikiSection num={num("nearby")} id="nearby" title="Nearby Temples">
              <NearbyTemples nearby={temple.nearbyTemples} />
            </WikiSection>
          )}

          {full && temple.reviews?.length > 0 && (
            <WikiSection num={num("reviews")} id="reviews" title="Devotee Reviews">
              <Reviews reviews={temple.reviews} />
            </WikiSection>
          )}

          {full && (
            <WikiSection num={num("contact")} id="contact" title="Contact & Accessibility">
              <p className="text-[15px]">{temple.contact.address}</p>
              {temple.contact.phone && <p className="text-[15px]">Phone: {temple.contact.phone}</p>}
              {temple.contact.email && <p className="text-[15px]">Email: {temple.contact.email}</p>}
            </WikiSection>
          )}

          <WikiSection num={num("references")} id="references" title="References">
            <References references={temple.references} />
          </WikiSection>
        </div>

        <div className="shrink-0 lg:order-last">
          <Infobox temple={temple} />
        </div>
      </div>
    </article>
  );
}
