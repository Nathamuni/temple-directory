import type { Metadata } from "next";
import Link from "next/link";
import { getAllTemples, completeness, getDataErrors } from "@/lib/temples";
import { getViewer } from "@/lib/authz";
import type { TempleStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Directory Status",
  description: "Onboarding progress of the Temple Directory — entry statuses, totals and data completeness.",
};

const STATUS_ORDER: TempleStatus[] = ["published", "verified", "pending", "draft", "rejected"];

const ADVANCE: Partial<Record<TempleStatus, TempleStatus>> = {
  draft: "pending",
  pending: "verified",
  verified: "published",
};
const ADVANCE_LABEL: Partial<Record<TempleStatus, string>> = {
  draft: "Send for review",
  pending: "Mark verified",
  verified: "Publish",
};
const RETREAT: Partial<Record<TempleStatus, TempleStatus>> = {
  pending: "draft",
  verified: "pending",
  published: "verified",
  rejected: "draft",
};
const RETREAT_LABEL: Partial<Record<TempleStatus, string>> = {
  pending: "Back to draft",
  verified: "Back to pending",
  published: "Unpublish",
  rejected: "Reopen as draft",
};
/** Statuses an admin can still reject from — a decision already made either way is final. */
const REJECTABLE: TempleStatus[] = ["draft", "pending", "verified"];

const STATUS_STYLE: Record<TempleStatus, { label: string; cls: string }> = {
  published: { label: "Published", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  verified: { label: "Verified", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  pending: { label: "Pending review", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-700 border-gray-300" },
  rejected: { label: "Rejected", cls: "bg-rose-50 text-rose-800 border-rose-200" },
};

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

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const temples = getAllTemples();
  const viewer = await getViewer();
  const isAdmin = Boolean(viewer?.isAdmin);
  const { error } = await searchParams;
  const byStatus = (s: TempleStatus) => temples.filter((t) => t.status === s);
  const dataErrors = getDataErrors();
  const pendingCount = byStatus("pending").length + byStatus("draft").length;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <h1 className="text-2xl">Directory Status</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Onboarding progress across all temple entries — updated on every build from the data files.
      </p>
      {isAdmin && dataErrors.length > 0 && (
        <div className="alert mt-4">
          <span aria-hidden>⚠️</span>
          <div>
            <b>{dataErrors.length} data file(s) could not be loaded</b> and are excluded from the
            site. The rest of the directory is unaffected.
            <ul className="mt-1 mb-0 list-disc pl-5">
              {dataErrors.map((failure) => (
                <li key={failure.file}>
                  <code>{failure.file}</code> — {failure.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!isAdmin && (
        <p className="ui mt-2 text-xs text-[var(--ink-soft)]">
          <Link href="/login?next=/status" className="underline">
            Log in as admin
          </Link>{" "}
          to review, verify, and publish entries from this page.
        </p>
      )}
      {error && (
        <p className="ui mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total temples" value={String(temples.length)} sub="entries in data/temples/" />
        <StatTile
          label="Live"
          value={String(byStatus("published").length + byStatus("verified").length)}
          sub="published + verified"
        />
        <StatTile label="Total pending" value={String(pendingCount)} sub="pending review + draft" />
        <StatTile
          label="Needs sourcing"
          value={String(temples.filter((t) => completeness(t).pct < 70).length)}
          sub="under 70% of the schema filled"
        />
      </div>

      <h2 className="wiki-h2">Entries</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="ui bg-[var(--paper-soft)] text-left">
              <th className="border border-[var(--line-soft)] px-3 py-2">Temple</th>
              <th className="border border-[var(--line-soft)] px-3 py-2">Submitted by</th>
              <th className="border border-[var(--line-soft)] px-3 py-2">State</th>
              <th className="border border-[var(--line-soft)] px-3 py-2">Status</th>
              <th className="border border-[var(--line-soft)] px-3 py-2">Data completeness</th>
              {isAdmin && (
                <th className="border border-[var(--line-soft)] px-3 py-2">Admin actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {STATUS_ORDER.flatMap((s) => byStatus(s)).map((t) => {
              const c = completeness(t);
              const style = STATUS_STYLE[t.status];
              const advance = ADVANCE[t.status];
              const retreat = RETREAT[t.status];
              return (
                <tr key={t.slug}>
                  <td className="border border-[var(--line-soft)] px-3 py-2 font-semibold">
                    <Link href={`/temple/${t.slug}`}>{t.identity.nameEn}</Link>
                  </td>
                  <td className="border border-[var(--line-soft)] px-3 py-2 whitespace-nowrap">
                    {t.submittedBy ? (
                      <span className="ui">{t.submittedBy}</span>
                    ) : (
                      <span className="ui text-[var(--ink-soft)]">— (seed data)</span>
                    )}
                  </td>
                  <td className="border border-[var(--line-soft)] px-3 py-2 whitespace-nowrap">
                    {t.location.stateProvince}
                  </td>
                  <td className="border border-[var(--line-soft)] px-3 py-2">
                    <span className={`ui inline-block rounded border px-2 py-0.5 text-xs font-semibold ${style.cls}`}>
                      {style.label}
                    </span>
                    {t.status === "rejected" && t.rejectionReason && (
                      <div className="ui mt-1 text-xs text-[var(--ink-soft)]">
                        Reason: {t.rejectionReason}
                      </div>
                    )}
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
                        {c.missing.filter((i) => i.level === "error").length} required,{" "}
                        {c.missing.filter((i) => i.level === "warning").length} recommended field(s)
                        still empty
                      </div>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="border border-[var(--line-soft)] px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {advance && (
                          <form method="POST" action={`/api/temples/${t.slug}/status`}>
                            <input type="hidden" name="status" value={advance} />
                            <button
                              type="submit"
                              className="ui border border-[var(--line-soft)] bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              {ADVANCE_LABEL[t.status]}
                            </button>
                          </form>
                        )}
                        {retreat && (
                          <form method="POST" action={`/api/temples/${t.slug}/status`}>
                            <input type="hidden" name="status" value={retreat} />
                            <button
                              type="submit"
                              className="ui border border-[var(--line-soft)] px-2 py-1 text-xs font-semibold text-[var(--ink-soft)] hover:bg-[var(--paper-soft)]"
                            >
                              {RETREAT_LABEL[t.status]}
                            </button>
                          </form>
                        )}
                        {REJECTABLE.includes(t.status) && (
                          <form
                            method="POST"
                            action={`/api/temples/${t.slug}/status`}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="status" value="rejected" />
                            <input
                              type="text"
                              name="reason"
                              required
                              placeholder="Reason"
                              className="ui w-24 border border-[var(--line-soft)] px-1.5 py-1 text-xs"
                            />
                            <button
                              type="submit"
                              className="ui border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                            >
                              Reject
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="ui mt-4 text-xs text-[var(--ink-soft)]">
        Statuses come from each entry&apos;s <code>status</code> field (draft → pending → verified →
        published). Completeness is measured against the input schema&apos;s required and recommended
        columns. This directory collects no money: there is no donation, sponsorship or payment flow
        anywhere in the product.
      </p>
    </div>
  );
}
