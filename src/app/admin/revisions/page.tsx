import type { Metadata } from "next";
import Link from "next/link";
import { DecisionForms, Notice, StatusPill, cellCls, headCls } from "@/components/account/ui";
import { requireAdmin } from "@/lib/authz";
import { AREA_LABEL, vouchableAreas } from "@/lib/fieldAuthority";
import { describeChanges } from "@/lib/revisionDiff";
import { ROLE_LABEL } from "@/lib/roles";
import { listRevisions } from "@/lib/store/revisions";
import { getTemple } from "@/lib/temples";

export const metadata: Metadata = { title: "Proposed changes — Temple Directory" };

export default async function RevisionsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("/admin/revisions");
  const { error } = await searchParams;
  const all = listRevisions().reverse();
  const pending = all.filter((r) => r.status === "pending");
  const decided = all.filter((r) => r.status !== "pending").slice(0, 50);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <p className="ui text-sm"><Link href="/admin" className="underline">← Admin console</Link></p>
      <h1 className="text-2xl">Proposed changes to live temples</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        The public page keeps its current content until you approve. Approving a temple-management or
        priest change also marks the sections they changed or confirmed as <em>authority-verified</em>.
        If the temple changed since the proposal, approval stops and the change is marked conflict.
      </p>
      {error && <Notice tone="error">{error}</Notice>}

      {pending.length === 0 && <p className="ui mt-6 text-sm text-[var(--ink-soft)]">Nothing waiting.</p>}
      {pending.map((r) => {
        const current = getTemple(r.templeSlug);
        const diff = current ? describeChanges(current, r.proposed, r.changedAreas) : [];
        const vouched = vouchableAreas(r.actingRole, [...new Set([...r.changedAreas, ...r.confirmedAreas])]);
        return (
          <article key={r.id} className="mt-6 rounded-xl border border-[var(--line-soft)] p-4">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <strong><Link href={`/temple/${r.templeSlug}`} className="underline">{current?.identity.nameEn ?? r.templeSlug}</Link></strong>
                <span className="ui text-sm text-[var(--ink-soft)]"> · {r.submittedBy} as {ROLE_LABEL[r.actingRole]} · {new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <DecisionForms action={`/api/admin/revisions/${r.id}`} approveLabel="Approve & publish" />
            </header>
            {r.note && <p className="ui mt-2 mb-0 text-sm"><strong>Note:</strong> {r.note}</p>}
            {vouched.length > 0 && (
              <p className="ui mt-2 mb-0 text-sm">
                Approving marks as authority-verified: <strong>{vouched.map((a) => AREA_LABEL[a]).join(", ")}</strong>
              </p>
            )}
            {r.confirmedAreas.filter((a) => !r.changedAreas.includes(a)).length > 0 && (
              <p className="ui mt-1 mb-0 text-sm text-[var(--ink-soft)]">
                Confirmed as current without changes: {r.confirmedAreas.filter((a) => !r.changedAreas.includes(a)).map((a) => AREA_LABEL[a]).join(", ")}
              </p>
            )}
            {diff.map(({ area, changes }) => (
              <div key={area} className="mt-3 overflow-x-auto">
                <h3 className="ui m-0 text-sm font-bold">{AREA_LABEL[area]}</h3>
                <table className="mt-1 w-full border-collapse text-xs">
                  <thead><tr className={headCls}><th className={cellCls}>Field</th><th className={cellCls}>Now on the site</th><th className={cellCls}>Proposed</th></tr></thead>
                  <tbody>
                    {changes.map((c, i) => (
                      <tr key={i}>
                        <td className={`${cellCls} font-semibold`}>{c.label}</td>
                        <td className={`${cellCls} max-w-[420px] break-words bg-rose-50/40`}>{c.before}</td>
                        <td className={`${cellCls} max-w-[420px] break-words bg-emerald-50/40`}>{c.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </article>
        );
      })}

      {decided.length > 0 && (
        <>
          <h2 className="mt-10 text-lg">Recently decided</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead><tr className={headCls}><th className={cellCls}>Temple</th><th className={cellCls}>By</th><th className={cellCls}>Sections</th><th className={cellCls}>Outcome</th></tr></thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id}>
                    <td className={cellCls}>{getTemple(r.templeSlug)?.identity.nameEn ?? r.templeSlug}</td>
                    <td className={cellCls}>{r.submittedBy} ({ROLE_LABEL[r.actingRole]})</td>
                    <td className={cellCls}>{[...new Set([...r.changedAreas, ...r.confirmedAreas])].map((a) => AREA_LABEL[a]).join(", ")}</td>
                    <td className={cellCls}><StatusPill status={r.status} />{r.reason && <div className="ui mt-1 text-xs text-[var(--ink-soft)]">{r.reason}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
