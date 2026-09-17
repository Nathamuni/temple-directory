import type { Temple } from "@/lib/types";
import Section from "./Section";

/** Why devotees know this temple — the sacred idea, before any logistics. */
export default function SacredSignificance({ temple }: { temple: Temple }) {
  const { identity, narrative } = temple;
  const lead = [identity.spiritualSignificanceShort, narrative.sacredTree && `Sthala vriksham: ${narrative.sacredTree}.`, narrative.sacredTank && `Sacred tank: ${narrative.sacredTank}.`]
    .filter(Boolean)
    .join(" ");

  return (
    <Section id="significance" kicker="Why devotees know this temple" title="Sacred significance">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <p className="text-base leading-[1.75] text-[#4c4038]">{lead}</p>
          {identity.sacredClassifications.length > 1 && (
            <p className="text-base leading-[1.75] text-[#4c4038]">
              Also recorded as: {identity.sacredClassifications.slice(1).join(", ")}.
            </p>
          )}
          {narrative.associatedSaints.length > 0 && (
            <p className="text-base leading-[1.75] text-[#4c4038]">
              Associated saints and acharyas: {narrative.associatedSaints.join(", ")}.
            </p>
          )}
          {narrative.sacredTextReferences && (
            <p className="text-base leading-[1.75] text-[#4c4038]">{narrative.sacredTextReferences}</p>
          )}
        </div>
        <blockquote className="m-0 flex min-h-full flex-col justify-between rounded-[18px] bg-[linear-gradient(145deg,#5c1918,#3d1011)] p-5 text-[#f8ead3]">
          <strong className="display text-[23px] leading-tight">
            A temple page should explain the sacred idea first — not bury it under contact details.
          </strong>
          <span className="mt-5 text-xs text-[#e9c99a]">Temple Directory information-design principle</span>
        </blockquote>
      </div>
    </Section>
  );
}
