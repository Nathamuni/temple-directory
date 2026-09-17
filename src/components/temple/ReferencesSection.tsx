import type { SourceRecord, Temple } from "@/lib/types";
import Section from "./Section";

const PRIMARY: SourceRecord["sourceType"][] = [
  "official temple",
  "government",
  "priest/temple authority",
  "inscription",
];

function SourceList({ sources }: { sources: SourceRecord[] }) {
  return (
    <ol className="m-0 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-[#5b4d43]">
      {sources.map((source) => (
        <li key={source.sourceId} id={`ref-${source.sourceId}`}>
          {source.url ? (
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
          ) : (
            source.title
          )}
          {source.publisherOrAuthority && <> — {source.publisherOrAuthority}</>}
          {source.author && <>, {source.author}</>}
          {source.accessDate && <> (accessed {source.accessDate})</>}
          {!source.adminApproved && <span className="sourcechip conflict ml-1">Awaiting editor approval</span>}
          {source.reliabilityNote && (
            <div className="mt-0.5 text-xs text-[#706050]">{source.reliabilityNote}</div>
          )}
          {source.claimScope && <div className="mt-0.5 text-xs text-[#706050]">Supports: {source.claimScope}</div>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Sources stay attached to the field, step, image, pooja or festival they
 * support; this section is the full list, not the only place they appear.
 */
export default function ReferencesSection({ temple }: { temple: Temple }) {
  const primary = temple.sources.filter((s) => PRIMARY.includes(s.sourceType));
  const enrichment = temple.sources.filter((s) => !PRIMARY.includes(s.sourceType));

  return (
    <Section id="sources" kicker="Trust layer" title="References & provenance">
      {temple.sources.length === 0 ? (
        <p className="m-0 text-[15px] text-muted">No sources have been recorded for this entry yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mt-0 mb-2 text-base font-bold">Primary & official sources</h3>
            {primary.length ? (
              <SourceList sources={primary} />
            ) : (
              <p className="m-0 text-[13px] text-muted">None recorded.</p>
            )}
          </div>
          <div>
            <h3 className="mt-0 mb-2 text-base font-bold">Enrichment sources</h3>
            {enrichment.length ? (
              <SourceList sources={enrichment} />
            ) : (
              <p className="m-0 text-[13px] text-muted">None recorded.</p>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
