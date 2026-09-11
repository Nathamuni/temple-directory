"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface SearchEntry {
  slug: string;
  name: string;
  city: string;
  state: string;
  deity: string;
}

export default function SearchLite({ entries }: { entries: SearchEntry[] }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return entries.filter((e) =>
      [e.name, e.city, e.state, e.deity].some((v) => v.toLowerCase().includes(needle))
    );
  }, [q, entries]);

  return (
    <div className="relative mx-auto max-w-xl">
      <input
        className="ui w-full border border-[var(--line)] px-4 py-2.5 text-base"
        placeholder="Find your temple — by name, city, or deity…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search temples"
      />
      {q.trim() && (
        <div className="absolute z-10 mt-1 w-full border border-[var(--line-soft)] bg-[var(--paper)] shadow-sm">
          {results.length === 0 ? (
            <div className="ui px-4 py-2 text-sm text-[var(--ink-soft)]">No matches yet.</div>
          ) : (
            results.map((r) => (
              <Link
                key={r.slug}
                href={`/temple/${r.slug}`}
                className="block px-4 py-2 text-sm hover:bg-[var(--paper-soft)]"
              >
                {r.name}
                <span className="ui ml-1 text-xs text-[var(--ink-soft)]">
                  — {r.deity} · {r.city}, {r.state}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
