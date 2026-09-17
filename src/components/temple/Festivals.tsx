import type { Temple } from "@/lib/types";
import { festivalsForDisplay, isMajorFestival } from "@/lib/temple-view";
import Section from "./Section";
import { EvidenceBlock } from "@/components/evidence/Evidence";

export default function Festivals({ temple }: { temple: Temple }) {
  const festivals = festivalsForDisplay(temple);
  if (festivals.length === 0) return null;

  return (
    <Section id="festivals" kicker="Annual rhythm" title="Major festivals">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {festivals.map((festival) => (
          <div key={festival.festivalId} className="info-card">
            <b className="mb-1.5 flex items-center gap-2">
              {festival.festivalNameEn}
              {isMajorFestival(temple, festival.festivalId) && <span className="badge ok">Major</span>}
            </b>
            <p className="m-0 text-[13px] leading-relaxed text-[#67574c]">{festival.significance}</p>
            <p className="mt-1.5 mb-0 text-xs text-[#77634f]">
              {[festival.tamilOrLocalMonth, festival.gregorianRuleOrDate, festival.duration]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {festival.processionOrRituals && (
              <p className="mt-1.5 mb-0 text-[13px] text-[#67574c]">{festival.processionOrRituals}</p>
            )}
            {(festival.crowdNote || festival.visitorAdvice) && (
              <p className="mt-1.5 mb-0 text-xs text-[#77634f]">
                {[festival.crowdNote, festival.visitorAdvice].filter(Boolean).join(" · ")}
              </p>
            )}
            <EvidenceBlock temple={temple} sourceIds={festival.sourceIds} status={festival.verificationStatus} />
          </div>
        ))}
      </div>
    </Section>
  );
}
