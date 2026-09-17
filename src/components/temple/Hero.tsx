import type { Temple } from "@/lib/types";
import { heroImage, subtitle } from "@/lib/temple-view";
import { EvidenceBlock } from "@/components/evidence/Evidence";

/** Full-bleed hero: sacred idea first, contact details much later. */
export default function Hero({ temple }: { temple: Temple }) {
  const hero = heroImage(temple);
  const { identity } = temple;
  const pills = [
    identity.presidingDeity,
    temple.location.district && `${temple.location.district} District`,
    temple.narrative.architectureStyle,
    identity.tradition,
  ].filter(Boolean) as string[];

  return (
    <section className="mx-auto max-w-[1440px] px-3 pt-3 sm:px-6 sm:pt-6">
      <div
        className="relative min-h-[520px] overflow-hidden rounded-[28px] bg-[#4a241c] bg-cover bg-center shadow-[var(--shadow-hero)]"
        style={hero ? { backgroundImage: `url(${JSON.stringify(hero.fileOrUrl)})` } : undefined}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(30,12,10,.91)_0%,rgba(44,16,13,.72)_44%,rgba(30,12,10,.13)_74%,rgba(30,12,10,.18)_100%),linear-gradient(0deg,rgba(15,8,5,.55),transparent_44%)]"
        />
        <div className="relative z-10 w-full px-6 py-12 text-white sm:w-[min(690px,86%)] sm:px-14 sm:py-16">
          {identity.sacredClassifications[0] && (
            <div className="text-[13px] font-extrabold tracking-[0.18em] text-[#f5c86d] uppercase">
              {identity.sacredClassifications[0]}
            </div>
          )}
          {/* leading must clear tall Indic glyphs: the page is machine-translatable
              into Tamil, Devanagari and other scripts whose ascenders and
              descenders overflow the 0.98 used for the Latin display face. */}
          <h1 className="my-4 text-[clamp(38px,6vw,78px)] leading-[1.12] font-bold">
            {identity.nameEn}
          </h1>
          <div className="mb-4 text-[21px] text-[#f7e5c8]">
            {identity.nameLocal ? `${identity.nameLocal} · ` : ""}
            {subtitle(temple)}
          </div>
          {temple.identity.spiritualSignificanceShort && (
            <p className="max-w-[610px] text-[17px] leading-relaxed text-[#f4eee9]">
              {temple.identity.spiritualSignificanceShort}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {pills.map((pill) => (
              <span key={pill} className="pill">
                {pill}
              </span>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <a
              href="#worship"
              className="inline-flex items-center gap-2 rounded-xl bg-[#f3c45b] px-4 py-3 font-extrabold text-[#3b1a10] hover:no-underline"
            >
              ✦ How to worship here
            </a>
            <a
              href="#visit"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 font-extrabold text-white hover:no-underline"
            >
              ◷ Plan your visit
            </a>
            <a
              href="#layout"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 font-extrabold text-white hover:no-underline"
            >
              ⌖ Temple layout
            </a>
          </div>
          {/* Identity is backed by the entry's approved sources as a whole,
              since Temple Master has no per-field source column. */}
          <EvidenceBlock
            temple={temple}
            sourceIds={temple.sources.filter((s) => s.adminApproved).map((s) => s.sourceId)}
            status={temple.editorial.overallVerificationStatus}
            lastVerified={temple.editorial.lastVerifiedDate}
            note={temple.editorial.verificationNotes}
          />
        </div>
        {hero?.attributionText && (
          <div className="absolute right-4 bottom-4 left-4 z-10 max-w-[340px] rounded-xl border border-white/15 bg-[#23130d]/70 px-3 py-2.5 text-[11px] text-white backdrop-blur-sm sm:left-auto">
            Photo: {hero.title} · {hero.attributionText}
          </div>
        )}
      </div>
    </section>
  );
}
