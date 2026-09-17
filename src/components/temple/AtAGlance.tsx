import type { Temple } from "@/lib/types";
import { atAGlance } from "@/lib/temple-view";
import Section from "./Section";
import { EvidenceBlock } from "@/components/evidence/Evidence";

/** Four derived identity facts — computed from Temple Master, never stored. */
export default function AtAGlance({ temple }: { temple: Temple }) {
  return (
    <Section id="glance" kicker="Temple identity" title="At a glance" status={temple.editorial.overallVerificationStatus}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {atAGlance(temple).map((fact) => (
          <div key={fact.label} className="fact">
            <div className="text-[10px] font-black tracking-[0.12em] text-[#7a5c36] uppercase">
              {fact.label}
            </div>
            <div className="mt-1.5 text-[15px] leading-tight font-extrabold">{fact.value}</div>
            {fact.sub && <div className="mt-1 text-xs text-[#6b5b4d]">{fact.sub}</div>}
          </div>
        ))}
      </div>
      <EvidenceBlock
        temple={temple}
        sourceIds={temple.sources.filter((s) => s.adminApproved).map((s) => s.sourceId)}
        note="Governance and administration wording can change; the source date is stored with the field so a contested entry is never presented as settled."
        lastVerified={temple.editorial.lastVerifiedDate}
      />
    </Section>
  );
}
