import Link from "next/link";
import type { Temple } from "@/lib/types";

/* eslint-disable @next/next/no-img-element */
export default function TempleCard({ temple }: { temple: Temple }) {
  return (
    <Link
      href={`/temple/${temple.slug}`}
      className="block border border-[var(--line-soft)] !text-[var(--ink)] transition-none hover:border-[var(--line)] hover:!no-underline"
    >
      <img
        src={temple.heroImage.src}
        alt={temple.heroImage.alt}
        loading="lazy"
        className="h-40 w-full object-cover"
      />
      <div className="p-3">
        <div className="font-bold leading-snug">{temple.name}</div>
        <div className="ui mt-0.5 text-xs text-[var(--ink-soft)]">
          {temple.deity.presiding} · {temple.location.city}, {temple.location.state}
        </div>
        <div className="ui mt-1.5 flex items-center justify-between text-xs">
          <span className="text-[var(--accent)]">🪔 {temple.lamp?.lampsToday ?? 0} lamps today</span>
          <span className="text-[var(--ink-soft)]">{temple.classification.templeType}</span>
        </div>
      </div>
    </Link>
  );
}
