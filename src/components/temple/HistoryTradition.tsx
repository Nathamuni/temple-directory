import type { Temple } from "@/lib/types";
import Section from "./Section";
import { EvidenceBlock } from "@/components/evidence/Evidence";

/**
 * Tradition and chronology are deliberately separated: a sthala puranam is a
 * devotional account, and presenting it as archaeology would misrepresent both.
 */
export default function HistoryTradition({ temple }: { temple: Temple }) {
  const { narrative } = temple;
  return (
    <Section id="history" kicker="Separate belief from chronology" title="History & temple tradition">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="info-card">
          <b className="mb-1.5 block">Traditional & devotional account</b>
          <p className="m-0 text-[13px] leading-relaxed whitespace-pre-line text-[#67574c]">
            {narrative.sthalaPuranam ||
              "No sthala puranam has been recorded for this temple yet. It belongs here, clearly labelled as temple tradition and supported by a temple publication, scripture reference or named oral authority."}
          </p>
        </div>
        <div className="info-card">
          <b className="mb-1.5 block">Documented historical development</b>
          <p className="m-0 text-[13px] leading-relaxed whitespace-pre-line text-[#67574c]">
            {narrative.documentedHistory || "No documented history has been recorded for this temple yet."}
          </p>
          {narrative.inscriptionsSummary && (
            <p className="mt-2 mb-0 text-[13px] leading-relaxed text-[#67574c]">
              <b>Inscriptions:</b> {narrative.inscriptionsSummary}
            </p>
          )}
        </div>
      </div>
      <EvidenceBlock
        temple={temple}
        note="This section is split so devotional tradition is never presented as archaeological chronology."
      />
    </Section>
  );
}
