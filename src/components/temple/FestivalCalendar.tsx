import type { Festival } from "@/lib/types";

export default function FestivalCalendar({ festivals }: { festivals: Festival[] }) {
  if (!festivals?.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="ui bg-[var(--paper-soft)] text-left">
            <th className="border border-[var(--line-soft)] px-3 py-1.5">Festival</th>
            <th className="border border-[var(--line-soft)] px-3 py-1.5">Month</th>
            <th className="border border-[var(--line-soft)] px-3 py-1.5">Duration</th>
            <th className="border border-[var(--line-soft)] px-3 py-1.5">Description</th>
          </tr>
        </thead>
        <tbody>
          {festivals.map((f) => (
            <tr key={f.name}>
              <td className="border border-[var(--line-soft)] px-3 py-1.5 font-semibold">
                {f.name}
                {f.major && (
                  <span className="ui ml-1.5 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent)]">
                    major
                  </span>
                )}
              </td>
              <td className="border border-[var(--line-soft)] px-3 py-1.5 whitespace-nowrap">{f.month}</td>
              <td className="border border-[var(--line-soft)] px-3 py-1.5 whitespace-nowrap">{f.duration ?? "—"}</td>
              <td className="border border-[var(--line-soft)] px-3 py-1.5">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
