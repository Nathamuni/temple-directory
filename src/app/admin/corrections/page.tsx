import type { Metadata } from "next";
import Link from "next/link";
import { Notice, StatusPill, cellCls, headCls } from "@/components/account/ui";
import { requireAdmin } from "@/lib/authz";
import { listCorrections } from "@/lib/store/corrections";
import { getTemple } from "@/lib/temples";

export const metadata: Metadata = { title: "Corrections — Temple Directory" };

export default async function CorrectionsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("/admin/corrections");
  const { error } = await searchParams;
  const all = listCorrections().reverse();
  const rows = [...all.filter((c) => c.status === "pending"), ...all.filter((c) => c.status !== "pending").slice(0, 50)];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <p className="ui text-sm"><Link href="/admin" className="underline">← Admin console</Link></p>
      <h1 className="text-2xl">Corrections & observations</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Free-text reports from devotees. Fix the entry through a proposed change, the Excel round
        trip or the contributor who owns it, then mark the report resolved. Dismissing needs a reason
        the reporter will see.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      {rows.length === 0 ? (
        <p className="ui mt-6 text-sm text-[var(--ink-soft)]">No corrections yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr className={headCls}><th className={cellCls}>Temple</th><th className={cellCls}>Report</th><th className={cellCls}>From</th><th className={cellCls}>Status</th><th className={cellCls}>Action</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className={cellCls}>
                    <Link href={`/temple/${c.templeSlug}`} className="underline">{getTemple(c.templeSlug)?.identity.nameEn ?? c.templeSlug}</Link>
                    <div className="ui text-xs text-[var(--ink-soft)]">{c.section}</div>
                  </td>
                  <td className={`${cellCls} max-w-[420px]`}>
                    <span className="ui text-xs font-semibold uppercase text-[var(--ink-soft)]">{c.kind}</span>
                    <div className="whitespace-pre-wrap">{c.message}</div>
                    {c.sourceUrl && <a href={c.sourceUrl} rel="noopener noreferrer nofollow" target="_blank" className="ui text-xs underline break-all">{c.sourceUrl}</a>}
                  </td>
                  <td className={cellCls}>{c.submittedBy}<div className="ui text-xs text-[var(--ink-soft)]">{new Date(c.submittedAt).toLocaleDateString()}</div></td>
                  <td className={cellCls}><StatusPill status={c.status} />{c.response && <div className="ui mt-1 text-xs text-[var(--ink-soft)]">{c.response}</div>}</td>
                  <td className={cellCls}>
                    {c.status === "pending" && (
                      <div className="flex flex-col gap-1.5">
                        <form method="POST" action={`/api/admin/corrections/${c.id}`} className="flex items-center gap-1">
                          <input type="hidden" name="decision" value="resolved" />
                          <input name="response" placeholder="Note (optional)" aria-label="Resolution note" className="ui w-32 border border-[var(--line-soft)] px-1.5 py-1 text-xs" />
                          <button type="submit" className="ui border border-[var(--line-soft)] bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">Resolved</button>
                        </form>
                        <form method="POST" action={`/api/admin/corrections/${c.id}`} className="flex items-center gap-1">
                          <input type="hidden" name="decision" value="dismissed" />
                          <input name="response" required placeholder="Reason" aria-label="Reason to dismiss" className="ui w-32 border border-[var(--line-soft)] px-1.5 py-1 text-xs" />
                          <button type="submit" className="ui border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">Dismiss</button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
