import type { Reference } from "@/lib/types";

export default function References({ references }: { references: Reference[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-6 text-sm">
      {references.map((r) => (
        <li key={r.id} id={`ref-${r.id}`} className="scroll-mt-20">
          {r.url ? (
            <a href={r.url} target="_blank" rel="noopener noreferrer">
              {r.title}
            </a>
          ) : (
            r.title
          )}
          {r.publisher && <span className="text-[var(--ink-soft)]"> — {r.publisher}</span>}
          {r.accessed && (
            <span className="text-[var(--ink-soft)]"> (accessed {r.accessed})</span>
          )}
        </li>
      ))}
    </ol>
  );
}
