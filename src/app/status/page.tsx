import type { Metadata } from "next";
import Link from "next/link";
import { getAllTemples } from "@/lib/temples";
import type { Temple, TempleStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Directory Status",
  description: "Onboarding progress of the Temple Directory — entry statuses, totals and data completeness.",
};

const STATUS_ORDER: TempleStatus[] = ["published", "verified", "pending", "draft"];

const STATUS_STYLE: Record<TempleStatus, { label: string; cls: string }> = {
  published: { label: "Published", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  verified: { label: "Verified", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  pending: { label: "Pending review", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-700 border-gray-300" },
};

function completeness(t: Temple): { pct: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ["Introduction", (t.sections?.introduction?.paragraphs?.length ?? 0) > 0],
    ["History", (t.sections?.history?.paragraphs?.length ?? 0) > 0],
    ["Architecture", (t.sections?.architecture?.paragraphs?.length ?? 0) > 0],
    ["Significance", (t.sections?.religiousSignificance?.paragraphs?.length ?? 0) > 0],
    ["6-step SOP", t.worshipSOP?.steps?.length === 6],
    ["Festivals", (t.festivals?.length ?? 0) > 0],
    ["Visiting info", Boolean(t.visitingInfo?.bestTime)],
    ["Gallery", (t.gallery?.length ?? 0) > 0],
    ["References ≥ 2", (t.references?.length ?? 0) >= 2],
    ["Contact", Boolean(t.contact?.address)],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return {
    pct: Math.round((done / checks.length) * 100),
    missing: checks.filter(([, ok]) => !ok).map(([label]) => label),
  };
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-[var(--line-soft)] bg-[var(--paper-soft)] p-4">
      <div className="ui text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="ui mt-0.5 text-xs text-[var(--ink-soft)]">{sub}</div>}
    </div>
  );
}

export default function StatusPage() {
  const temples = getAllTemples();
  const byStatus = (s: TempleStatus) => temples.filter((t) => t.status === s);
  const totalLamps = temples.reduce((sum, t) => sum + (t.lamp?.lampsToday ?? 0), 0);
  // Mock valuation for the prototype: each active lamp valued at the daily tier (₹51).
  const lampValue = totalLamps * 51;
  const pendingCount = byStatus("pending").length + byStatus("draft").length;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <h1 className="text-2xl">Directory Status</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Onboarding progress across all temple entries — updated on every build from the data files.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Total temples" value={String(temples.length)} sub="entries in data/temples/" />
        <StatTile
          label="Live"
          value={String(byStatus("published").length + byStatus("verified").length)}
          sub="published + verified"
        />
        <StatTile label="Total pending" value={String(pendingCount)} sub="pending review + draft" />
        <StatTile label="Active lamps today" value={String(totalLamps)} sub="across all temples (mock)" />
        <StatTile
          label="Total lamp value"
          value={`₹${lampValue.toLocaleString("en-IN")}`}
          sub="today, at daily-tier rate (mock)"
        />
      </div>

      <h2 className="wiki-h2">Entries</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="ui bg-[var(--paper-soft)] text-left">
              <th className="border border-[var(--line-soft)] px-3 py-2">Temple</th>
              <th className="border border-[var(--line-soft)] px-3 py-2">State</th>
              <th className="border border-[var(--line-soft)] px-3 py-2">Status</th>
              <th className="border border-[var(--line-soft)] px-3 py-2">Data completeness</th>
              <th className="border border-[var(--line-soft)] px-3 py-2">Lamps today</th>
            </tr>
          </thead>
          <tbody>
            {STATUS_ORDER.flatMap((s) => byStatus(s)).map((t) => {
              const c = completeness(t);
              const style = STATUS_STYLE[t.status];
              return (
                <tr key={t.slug}>
                  <td className="border border-[var(--line-soft)] px-3 py-2 font-semibold">
                    <Link href={`/temple/${t.slug}`}>{t.name}</Link>
                  </td>
                  <td className="border border-[var(--line-soft)] px-3 py-2 whitespace-nowrap">
                    {t.location.state}
                  </td>
                  <td className="border border-[var(--line-soft)] px-3 py-2">
                    <span className={`ui inline-block rounded border px-2 py-0.5 text-xs font-semibold ${style.cls}`}>
                      {style.label}
                    </span>
                  </td>
                  <td className="border border-[var(--line-soft)] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 shrink-0 overflow-hidden rounded bg-[var(--paper-soft)] ring-1 ring-[var(--line-soft)]">
                        <div
                          className="h-full bg-[var(--accent)]"
                          style={{ width: `${c.pct}%` }}
                        />
                      </div>
                      <span className="ui text-xs font-semibold">{c.pct}%</span>
                    </div>
                    {c.missing.length > 0 && (
                      <div className="ui mt-1 text-xs text-[var(--ink-soft)]">
                        Missing: {c.missing.join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="border border-[var(--line-soft)] px-3 py-2 text-center">
                    🪔 {t.lamp?.lampsToday ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="ui mt-4 text-xs text-[var(--ink-soft)]">
        Statuses come from each entry&apos;s <code>status</code> field (draft → pending → verified →
        published). Completeness is computed from the ten core template sections. Lamp counts and
        values are prototype mock data until the donation module goes live.
      </p>
    </div>
  );
}
