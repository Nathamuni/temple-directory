import type { Temple } from "@/lib/types";
import { approvedMedia, shrinesForDisplay } from "@/lib/temple-view";
import Section from "./Section";
import MediaFigure from "./MediaFigure";
import { EvidenceBlock, NotVerified } from "@/components/evidence/Evidence";

/**
 * Orientation before instruction. A numbered worship order is shown only when
 * every shrine record is authority-verified; otherwise the spaces are listed
 * without implying a sequence.
 */
export default function TempleLayout({ temple }: { temple: Temple }) {
  const { shrines, ordered } = shrinesForDisplay(temple);
  const plan = approvedMedia(temple, ["map"])[0];
  if (shrines.length === 0 && !plan) return null;

  return (
    <Section id="layout" kicker="Orientation before instruction" title="Temple layout & sacred spaces">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {plan && (
          <div className="rounded-[18px] border border-[#dfcdb1] bg-[#f0e3ce] p-4">
            <MediaFigure media={plan} imgClassName="aspect-square bg-white object-contain" />
          </div>
        )}
        <div className="grid gap-2.5">
          {shrines.map((shrine, index) => (
            <div key={shrine.shrineId} className="grid grid-cols-[34px_1fr] gap-2.5">
              <div className="grid h-[30px] w-[30px] place-items-center rounded-full bg-forest font-black text-white">
                {ordered ? (shrine.sequenceNumber ?? index + 1) : "·"}
              </div>
              <div>
                <b className="block">
                  {shrine.shrineName}
                  {shrine.localName && <span className="font-normal text-muted"> · {shrine.localName}</span>}
                </b>
                <span className="text-xs text-[#776659]">
                  {[shrine.deityOrSubject, shrine.locationDescription].filter(Boolean).join(" · ") ||
                    shrine.spaceType}
                </span>
                {shrine.routeDirection && (
                  <span className="mt-1 block text-xs text-[#776659]">{shrine.routeDirection}</span>
                )}
                <EvidenceBlock temple={temple} sourceIds={shrine.sourceIds} status={shrine.verificationStatus} />
              </div>
            </div>
          ))}
          {!ordered && shrines.length > 0 && (
            <NotVerified what="the devotee shrine sequence and any pradakshina counts for this temple." />
          )}
        </div>
      </div>
    </Section>
  );
}
