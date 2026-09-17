import type { Temple } from "@/lib/types";
import { isVerified, resolveMedia, resolveShrines, sopInOrder } from "@/lib/temple-view";
import Section from "./Section";
import MediaFigure from "./MediaFigure";
import { EvidenceBlock, NotVerified } from "@/components/evidence/Evidence";

/**
 * The signature section. Each step's instruction becomes public text only when
 * its record is verified; otherwise the step is listed with a pending notice,
 * so a devotee can see that a route exists without being handed an unsourced
 * one as fact.
 *
 * Native <details> keeps the accordion working with JavaScript disabled.
 */
export default function WorshipSop({ temple }: { temple: Temple }) {
  const steps = sopInOrder(temple);

  return (
    <Section id="worship" kicker="Signature experience" title="How to worship here" badge="Temple-specific SOP">
      <div className="alert">
        <span aria-hidden>🛕</span>
        <div>
          <b>Editorial rule:</b> this directory never invents a universal shrine order, pradakshina
          count, entry-foot rule or mantra. Those appear publicly only once a temple authority,
          priest or published temple source has verified them.
        </div>
      </div>

      {steps.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">
          No worship steps have been recorded for this temple yet.
        </p>
      ) : (
        <div className="mt-3.5 grid gap-3">
          {steps.map((step, index) => {
            const verified = isVerified(step.verificationStatus);
            const media = resolveMedia(temple, step.linkedMediaIds);
            const shrines = resolveShrines(temple, step.linkedShrineIds);
            return (
              <details
                key={step.sopStepId}
                className="sop overflow-hidden rounded-2xl border border-[#e4d5bc] bg-[#fffdf8]"
                open={index === 0}
              >
                <summary className="flex w-full items-center gap-3.5 px-4 py-4 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-maroon font-black text-white">
                    {step.stepNumber}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-black">{step.stepTitle}</span>
                    <span className="mt-0.5 block text-[11px] text-[#79644f]">
                      {step.localTerms || step.explanation?.slice(0, 90) || "Temple-specific guidance"}
                    </span>
                  </span>
                  <span className="chev ml-auto text-lg text-[#8b6d4d]" aria-hidden>
                    ⌄
                  </span>
                </summary>
                <div className="px-4 pb-5 text-sm leading-relaxed text-[#56473e] sm:pl-[68px]">
                  {verified ? (
                    <>
                      <p className="mt-0 whitespace-pre-line">{step.instruction}</p>
                      {step.explanation && <p className="whitespace-pre-line">{step.explanation}</p>}
                      {step.mantraOrSloka && (
                        <p className="display rounded-xl bg-[#f6ecd8] px-3 py-2 text-[15px]">
                          {step.mantraOrSloka}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {step.explanation && <p className="mt-0 whitespace-pre-line">{step.explanation}</p>}
                      <NotVerified
                        what={`the exact wording of step ${step.stepNumber} for this temple.`}
                      />
                    </>
                  )}

                  {step.whatToCarry && (
                    <p>
                      <b>What to carry:</b> {step.whatToCarry}
                    </p>
                  )}
                  {step.restrictionOrCaution && (
                    <p>
                      <b>Please note:</b> {step.restrictionOrCaution}
                    </p>
                  )}
                  {shrines.length > 0 && (
                    <p>
                      <b>Related spaces:</b> {shrines.map((s) => s.shrineName).join(", ")}
                    </p>
                  )}
                  {media.length > 0 && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {media.map((item) => (
                        <MediaFigure key={item.mediaId} media={item} imgClassName="max-h-56" />
                      ))}
                    </div>
                  )}
                  <EvidenceBlock
                    temple={temple}
                    sourceIds={step.sourceIds}
                    status={step.verificationStatus}
                    note={
                      step.authorityReviewer
                        ? `Reviewed by ${step.authorityReviewer}${step.authorityReviewDate ? ` on ${step.authorityReviewDate}` : ""}.`
                        : undefined
                    }
                  />
                </div>
              </details>
            );
          })}
        </div>
      )}
    </Section>
  );
}
