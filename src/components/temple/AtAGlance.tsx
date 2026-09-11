import type { Temple } from "@/lib/types";

const ICONS: Record<string, string> = {
  deity: "🕉️",
  clock: "🕰️",
  dress: "👘",
  transit: "🚉",
  area: "🗺️",
  tower: "🛕",
};

export default function AtAGlance({ temple }: { temple: Temple }) {
  if (!temple.atAGlance?.length) return null;
  return (
    <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {temple.atAGlance.map((item) => (
        <div key={item.label} className="border border-[var(--line-soft)] bg-[var(--paper-soft)] p-3">
          <div className="ui text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            <span aria-hidden className="mr-1">
              {ICONS[item.icon] ?? "•"}
            </span>
            {item.label}
          </div>
          <div className="mt-1 text-sm leading-snug">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
