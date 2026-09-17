import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getTemplesBySubmitter, completeness } from "@/lib/temples";
import type { TempleStatus } from "@/lib/types";

export const metadata: Metadata = { title: "My Submissions — Temple Directory" };

const STATUS_STYLE: Record<TempleStatus, { label: string; cls: string }> = {
  published: { label: "Published", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  verified: { label: "Verified", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  pending: { label: "Pending review", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-700 border-gray-300" },
  rejected: { label: "Rejected", cls: "bg-rose-50 text-rose-800 border-rose-200" },
};
const EDITABLE: TempleStatus[] = ["draft", "rejected"];

export default async function MySubmissionsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/my-submissions");

  const temples = getTemplesBySubmitter(session.username);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <h1 className="text-2xl">My Submissions</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Temples you&apos;ve submitted, logged in as <strong>{session.username}</strong>. Editing a
        draft or rejected entry sends it back for admin review.
      </p>

      {temples.length === 0 ? (
        <p className="ui mt-6 text-sm text-[var(--ink-soft)]">
          You haven&apos;t submitted anything yet — head to{" "}
          <Link href="/contribute" className="underline">
            Contribute
          </Link>{" "}
          to add a temple.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="ui bg-[var(--paper-soft)] text-left">
                <th className="border border-[var(--line-soft)] px-3 py-2">Temple</th>
                <th className="border border-[var(--line-soft)] px-3 py-2">Status</th>
                <th className="border border-[var(--line-soft)] px-3 py-2">Data completeness</th>
                <th className="border border-[var(--line-soft)] px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {temples.map((t) => {
                const c = completeness(t);
                const style = STATUS_STYLE[t.status];
                return (
                  <tr key={t.slug}>
                    <td className="border border-[var(--line-soft)] px-3 py-2 font-semibold">
                      <Link href={`/temple/${t.slug}`}>{t.identity.nameEn}</Link>
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
                          <div className="h-full bg-[var(--accent)]" style={{ width: `${c.pct}%` }} />
                        </div>
                        <span className="ui text-xs font-semibold">{c.pct}%</span>
                      </div>
                    </td>
                    <td className="border border-[var(--line-soft)] px-3 py-2">
                      {EDITABLE.includes(t.status) ? (
                        <Link
                          href={`/my-submissions/${t.slug}/edit`}
                          className="ui border border-[var(--line-soft)] bg-[var(--paper-soft)] px-2 py-1 text-xs font-semibold hover:bg-[var(--paper)]"
                        >
                          Edit &amp; resubmit
                        </Link>
                      ) : (
                        <span className="ui text-xs text-[var(--ink-soft)]">
                          {t.status === "pending" ? "Awaiting review" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
