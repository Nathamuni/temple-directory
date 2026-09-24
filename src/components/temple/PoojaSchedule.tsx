import type { Temple } from "@/lib/types";
import { hasTimingConflict, poojasByTime } from "@/lib/temple-view";
import Section from "./Section";
import { EvidenceBlock } from "@/components/evidence/Evidence";

function timeRange(from?: string, to?: string): string {
  if (from && to) return `${from}–${to}`;
  return from ?? to ?? "—";
}

/** Repeatable pooja records, each with its own source and verification date. */
export default function PoojaSchedule({ temple }: { temple: Temple }) {
  const poojas = poojasByTime(temple);
  if (poojas.length === 0 && temple.openingHours.length === 0) return null;
  const withheld = temple.poojas.length - poojas.length;

  return (
    <Section
      id="schedule"
      kicker="Repeatable data, not paragraphs"
      title="Daily worship schedule"
      badge="Verify for travel date"
    >
      {hasTimingConflict(temple) && (
        <div className="alert mb-3">
          <span aria-hidden>⚠️</span>
          <div>
            <b>Sources disagree on this temple&apos;s hours.</b> Each timing is stored with its own
            source and verification date rather than as page copy, so the conflict stays visible
            instead of being silently resolved. Confirm with the temple before travelling.
          </div>
        </div>
      )}

      {temple.openingHours.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-line">
          {temple.openingHours.map((row) => (
            <div key={row.hoursId} className="grid grid-cols-[110px_1fr] border-b border-[#eadfcf] last:border-b-0">
              <div className="bg-[#f2e5d0] px-3 py-3 text-[13px] font-black text-[#6b351a]">
                {row.sessionName}
              </div>
              <div className="bg-[#fffdf7] px-3 py-3 text-sm">
                {row.closedFlag ? "Closed" : timeRange(row.openTime, row.closeTime)}
                {row.notes && <span className="mt-1 block text-xs text-[#7b6a5a]">{row.notes}</span>}
                <EvidenceBlock
                  temple={temple}
                  sourceIds={row.sourceIds}
                  status={row.verificationStatus}
                  verifiedBy={row.verifiedBy}
                  lastVerified={row.lastVerifiedDate}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {withheld > 0 && (
        <p className="mb-3 text-xs text-muted">
          {withheld} seva record{withheld === 1 ? "" : "s"} offered by this temple involve a
          sponsorship or payment and are not shown here — this directory carries no donation or
          payment flow. Ask the temple directly.
        </p>
      )}

      {poojas.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line">
          {poojas.map((pooja) => (
            <div key={pooja.poojaId} className="grid grid-cols-[110px_1fr] border-b border-[#eadfcf] last:border-b-0">
              <div className="bg-[#f2e5d0] px-3 py-3 text-[13px] font-black text-[#6b351a]">
                {timeRange(pooja.startTime, pooja.endTime)}
              </div>
              <div className="bg-[#fffdf7] px-3 py-3">
                <b className="block text-sm">
                  {pooja.nameEn}
                  {pooja.nameLocal && <span className="font-normal text-muted"> · {pooja.nameLocal}</span>}
                </b>
                {pooja.description && (
                  <span className="mt-1 block text-xs text-[#7b6a5a]">{pooja.description}</span>
                )}
                {/* booking_method and fee_note are deliberately not rendered:
                    the directory shows no payment or donation path. */}
                <EvidenceBlock
                  temple={temple}
                  sourceIds={pooja.sourceIds}
                  status={pooja.verificationStatus}
                  verifiedBy={pooja.verifiedBy}
                  lastVerified={pooja.lastVerifiedDate}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
