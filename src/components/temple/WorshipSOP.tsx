import type { Temple } from "@/lib/types";

export default function WorshipSOP({ sop }: { sop: Temple["worshipSOP"] }) {
  return (
    <div>
      <div className="my-3 border-l-4 border-[var(--accent)] bg-[var(--accent-soft)] p-3 text-sm">
        <strong className="ui">Worship SOP.</strong> This guide documents the worship sequence as
        practised at this temple, verified with temple sources. It describes what is customary — it
        does not prescribe belief.
      </div>

      {sop.entryGuidelines?.length > 0 && (
        <>
          <h3 className="wiki-h3">Entry Guidelines</h3>
          <ul className="list-disc space-y-1 pl-6 text-[15px]">
            {sop.entryGuidelines.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </>
      )}

      <h3 className="wiki-h3">Standard Worship Procedure — Step by Step</h3>
      <div className="space-y-2">
        {sop.steps.map((step, i) => (
          <details key={i} className="sop-step border border-[var(--line-soft)]" open={i === 0}>
            <summary className="ui flex items-center gap-3 bg-[var(--paper-soft)] px-3 py-2.5 text-sm font-semibold">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs text-white">
                {i + 1}
              </span>
              {step.title}
              <span className="ml-auto text-xs font-normal text-[var(--ink-soft)]">expand</span>
            </summary>
            <ul className="list-disc space-y-1.5 py-3 pl-10 pr-4 text-[15px]">
              {step.points.map((p, j) => (
                <li key={j}>{p}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      {sop.specialRituals?.length > 0 && (
        <>
          <h3 className="wiki-h3">Special Rituals</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="ui bg-[var(--paper-soft)] text-left">
                  <th className="border border-[var(--line-soft)] px-3 py-1.5">Ritual</th>
                  <th className="border border-[var(--line-soft)] px-3 py-1.5">Description</th>
                  <th className="border border-[var(--line-soft)] px-3 py-1.5">How to Book</th>
                </tr>
              </thead>
              <tbody>
                {sop.specialRituals.map((r) => (
                  <tr key={r.ritual}>
                    <td className="border border-[var(--line-soft)] px-3 py-1.5 font-semibold">
                      {r.ritual}
                    </td>
                    <td className="border border-[var(--line-soft)] px-3 py-1.5">{r.description}</td>
                    <td className="border border-[var(--line-soft)] px-3 py-1.5">{r.howToBook}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sop.restrictions?.length > 0 && (
        <>
          <h3 className="wiki-h3">Restrictions</h3>
          <ul className="list-disc space-y-1 pl-6 text-[15px]">
            {sop.restrictions.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}

      {sop.spiritualOutcomes?.length > 0 && (
        <>
          <h3 className="wiki-h3">Believed Spiritual Outcomes</h3>
          <div className="border border-[var(--line-soft)] bg-[var(--paper-soft)] p-3 text-[15px]">
            <ul className="list-disc space-y-1 pl-6">
              {sop.spiritualOutcomes.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
            <p className="ui mt-2 text-xs text-[var(--ink-soft)]">
              As documented in recognized texts and temple tradition; presented as record, not
              recommendation.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
