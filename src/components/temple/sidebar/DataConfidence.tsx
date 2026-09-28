import type { Temple } from "@/lib/types";
import { completeness } from "@/lib/validate";
import { isVerified } from "@/lib/temple-view";
import { publicTempleMantras } from "@/lib/mantras";

/** How far each area of this entry can be trusted, and where it is still thin. */
export default function DataConfidence({ temple }: { temple: Temple }) {
  const score = completeness(temple);

  const areas: { label: string; ok: boolean; note: string }[] = [
    {
      label: "Identity",
      ok: isVerified(temple.editorial.overallVerificationStatus),
      note: temple.editorial.overallVerificationStatus,
    },
    {
      label: "Worship sequence",
      ok: temple.worshipSop.length > 0 && temple.worshipSop.every((s) => isVerified(s.verificationStatus)),
      note: temple.worshipSop.length === 0 ? "none recorded" : "needs authority",
    },
    {
      label: "Prayers & slokas",
      ok: publicTempleMantras(temple).length > 0,
      note: temple.mantras.length === 0 ? "general only" : "awaiting priest",
    },
    {
      label: "Operational timings",
      ok: temple.openingHours.length > 0 && temple.openingHours.every((h) => isVerified(h.verificationStatus)),
      note: temple.openingHours.some((h) => h.verificationStatus === "conflict") ? "conflict" : "needs re-check",
    },
    {
      label: "Media rights",
      ok: temple.media.length > 0 && temple.media.every((m) => m.editorialApproved),
      note: temple.media.length === 0 ? "none recorded" : "pending review",
    },
    {
      label: "References",
      ok: temple.sources.filter((s) => s.adminApproved).length >= 2,
      note: `${temple.sources.filter((s) => s.adminApproved).length} approved`,
    },
  ];

  return (
    <div className="mb-3.5 rounded-[18px] border border-line bg-paper p-4 shadow-[var(--shadow-card)]">
      <h3 className="mt-0 mb-3 text-sm font-bold">Data confidence</h3>
      <div className="display text-[23px] text-[#4d1716]">{score.pct}% complete</div>
      <p className="text-xs leading-relaxed text-[#6d5e53]">
        Every claim on this page carries its own source and verification date. Switch on{" "}
        <b>Evidence</b> in the header to see them.
      </p>
      {areas.map((area) => (
        <div
          key={area.label}
          className="flex justify-between gap-3 border-t border-[#eee0c8] py-2.5 text-xs first-of-type:border-t-0"
        >
          <span>{area.label}</span>
          <span className={`badge ${area.ok ? "ok" : "warn"}`}>{area.ok ? "Verified" : area.note}</span>
        </div>
      ))}
    </div>
  );
}
