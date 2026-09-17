import type { Temple } from "@/lib/types";
import Section from "./Section";
import { EvidenceBlock } from "@/components/evidence/Evidence";

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="fact">
      <div className="text-[10px] font-black tracking-[0.12em] text-[#7a5c36] uppercase">{label}</div>
      <div className="mt-1.5 text-[15px] leading-tight font-extrabold">{value}</div>
      {sub && <div className="mt-1 text-xs text-[#6b5b4d]">{sub}</div>}
    </div>
  );
}

const NEEDS_CHECK = "Needs current verification";

/** Practical information — deliberately last, and always date-stamped. */
export default function PlanYourVisit({ temple }: { temple: Temple }) {
  const v = temple.visitingInfo;
  const km = (n?: number) => (n === undefined ? undefined : `approx. ${n} km`);

  const notes: [string, string | undefined][] = [
    ["Dress code", v.dressCode],
    ["Entry rules", v.entryRules],
    ["Footwear", v.footwearRules],
    ["Mobile phones", v.mobilePolicy],
    ["Prasad", v.prasadInfo],
    ["Accessibility", v.accessibilityNotes],
    ["Parking", v.parkingNotes],
    ["Accommodation", v.accommodationNotes],
  ];

  return (
    <Section
      id="visit"
      kicker="Practical information"
      title="Plan your visit"
      status={v.verificationStatus}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Railway" value={v.nearestRailStation ?? "Not recorded"} sub={km(v.railDistanceKm)} />
        <Fact label="Bus stand" value={v.nearestBusStation ?? "Not recorded"} sub={km(v.busDistanceKm)} />
        <Fact label="Airport" value={v.nearestAirport ?? "Not recorded"} sub={km(v.airportDistanceKm)} />
        {/* The policy itself goes in the sub-line: a stat tile should carry a
            verdict, not a truncated paragraph. */}
        <Fact
          label="Photography"
          value={v.photographyPolicy ? "Policy recorded" : NEEDS_CHECK}
          sub={v.photographyPolicy ?? "No current policy has been sourced"}
        />
      </div>

      {notes.some(([, value]) => value) && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {notes
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="info-card">
                <b className="mb-1.5 block">{label}</b>
                <p className="m-0 text-[13px] leading-relaxed whitespace-pre-line text-[#67574c]">{value}</p>
              </div>
            ))}
        </div>
      )}

      <div className="alert mt-3">
        <span aria-hidden>⏱️</span>
        <div>
          <b>Hours and rules are not hard-coded.</b> Every operational detail on this page carries the
          source it came from and the date it was last checked.{" "}
          {v.officialContactNote ?? "Confirm same-day timings with the temple before travelling."}
        </div>
      </div>

      <EvidenceBlock
        temple={temple}
        sourceIds={v.sourceIds}
        status={v.verificationStatus}
        lastVerified={v.lastVerifiedDate}
      />

      {(temple.governance.officialPhone || temple.governance.officialEmail || temple.extensions.address) && (
        <div className="mt-4 border-t border-line pt-4 text-sm text-[#5b4d43]">
          {temple.extensions.address && <p className="m-0">{temple.extensions.address}</p>}
          {temple.governance.officialPhone && <p className="m-0">Phone: {temple.governance.officialPhone}</p>}
          {temple.governance.officialEmail && <p className="m-0">Email: {temple.governance.officialEmail}</p>}
          {temple.governance.officialWebsite && (
            <p className="m-0">
              <a href={temple.governance.officialWebsite} target="_blank" rel="noopener noreferrer">
                Official website
              </a>
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
