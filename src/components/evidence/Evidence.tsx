import type { SourceRecord, Temple, VerificationStatus } from "@/lib/types";
import { isVerified, resolveSources } from "@/lib/temple-view";

/**
 * The evidence layer.
 *
 * These are ordinary server components: the chips are always rendered into the
 * HTML and hidden by CSS (`.evidence`), so provenance is present for crawlers
 * and testable without running JS, and the Clean/Evidence switch is a class on
 * <html> rather than a re-render.
 */

const VERIFIED_LABEL: Partial<Record<VerificationStatus, string>> = {
  verified: "Verified",
  "authority-verified": "Authority-verified",
  "cross-referenced": "Cross-referenced",
  approved: "Approved",
  partial: "Partial",
  sourced: "Sourced",
  conflict: "Source conflict",
  "needs recheck": "Needs re-check",
  unverified: "Unsourced",
  draft: "Draft",
  pending: "Pending review",
  rejected: "Rejected",
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const label = VERIFIED_LABEL[status] ?? status;
  return <span className={`badge ${isVerified(status) ? "ok" : "warn"}`}>{label}</span>;
}

export function SourceChip({ source }: { source: SourceRecord }) {
  const official = source.sourceType === "government" || source.sourceType === "official temple";
  const label = source.publisherOrAuthority || source.title;
  const chip = (
    <span className={`sourcechip${official && source.adminApproved ? " verified" : ""}`}>{label}</span>
  );
  return source.url ? (
    <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.title}>
      {chip}
    </a>
  ) : (
    chip
  );
}

/**
 * Provenance for one claim or record. Renders nothing at all when there is no
 * provenance and no note — an empty dashed box tells the reader less than
 * leaving the space clean.
 */
export function EvidenceBlock({
  temple,
  sourceIds,
  status,
  note,
  lastVerified,
}: {
  temple: Temple;
  sourceIds?: string[];
  status?: VerificationStatus;
  note?: string;
  lastVerified?: string;
}) {
  const sources = resolveSources(temple, sourceIds);
  if (sources.length === 0 && !note && !status) return null;

  return (
    <div className="evidence mt-3.5 rounded-xl border border-dashed border-[#d5b47c] bg-[#fff7e8] px-3 py-2.5 text-xs text-[#6e573c]">
      {sources.length > 0 ? (
        <div>
          {sources.map((source) => (
            <SourceChip key={source.sourceId} source={source} />
          ))}
        </div>
      ) : (
        <span className="sourcechip conflict">No source attached</span>
      )}
      {note && <p className="mt-1.5 mb-0">{note}</p>}
      {(status || lastVerified) && (
        <p className="mt-1.5 mb-0">
          {status && <>Status: {VERIFIED_LABEL[status] ?? status}. </>}
          {lastVerified && <>Last verified {lastVerified}.</>}
        </p>
      )}
    </div>
  );
}

/**
 * Shown in place of an instruction that no authority has signed off. The
 * directory never invents a shrine order, pradakshina count or mantra, and it
 * says so rather than silently omitting the step.
 */
export function NotVerified({ what, children }: { what: string; children?: React.ReactNode }) {
  return (
    <div className="not-verified">
      <b>Not published yet:</b> {what} This stays in editorial review until a temple authority,
      priest or published temple source confirms it.
      {children}
    </div>
  );
}
