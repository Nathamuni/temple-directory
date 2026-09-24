import type { Metadata } from "next";
import Link from "next/link";
import { DecisionForms, Notice, StatusPill, cellCls, headCls } from "@/components/account/ui";
import { requireAdmin } from "@/lib/authz";
import { APPLICATION_FIELDS, ROLE_LABEL } from "@/lib/roles";
import { getUser, listGrants, type GrantStatus } from "@/lib/store/accounts";
import { getTemple } from "@/lib/temples";

export const metadata: Metadata = { title: "Role applications — Temple Directory" };

const ORDER: GrantStatus[] = ["applied", "approved", "rejected", "revoked"];

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("/admin/applications");
  const { error } = await searchParams;
  const grants = listGrants()
    .filter((g) => !g.id.startsWith("builtin:"))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.appliedAt.localeCompare(a.appliedAt));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <p className="ui text-sm"><Link href="/admin" className="underline">← Admin console</Link></p>
      <h1 className="text-2xl">Role applications</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        For temple roles, check the affiliation evidence against public sources (official website,
        official email domain, a call to the temple office) before approving. Rejecting needs a
        reason, which the applicant sees.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      {grants.length === 0 ? (
        <p className="ui mt-6 text-sm text-[var(--ink-soft)]">No applications yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={headCls}>
                <th className={cellCls}>Applicant</th>
                <th className={cellCls}>Role</th>
                <th className={cellCls}>Application</th>
                <th className={cellCls}>Status</th>
                <th className={cellCls}>Decision</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => {
                const user = getUser(g.userId);
                return (
                  <tr key={g.id}>
                    <td className={cellCls}>
                      <strong>{user?.username ?? g.userId}</strong>
                      <div className="ui text-xs text-[var(--ink-soft)]">
                        {user?.name}<br />{user?.email}<br />{user?.phone}
                      </div>
                    </td>
                    <td className={cellCls}>
                      {ROLE_LABEL[g.role]}
                      {g.templeSlug && <div className="ui text-xs"><Link href={`/temple/${g.templeSlug}`} className="underline">{getTemple(g.templeSlug)?.identity.nameEn ?? g.templeSlug}</Link></div>}
                      <div className="ui text-xs text-[var(--ink-soft)]">{new Date(g.appliedAt).toLocaleDateString()}</div>
                    </td>
                    <td className={`${cellCls} max-w-[380px]`}>
                      <dl className="ui m-0 text-xs">
                        {APPLICATION_FIELDS[g.role].filter((f) => g.application[f.name]).map((f) => (
                          <div key={f.name} className="mb-1">
                            <dt className="font-semibold">{f.label}</dt>
                            <dd className="m-0 whitespace-pre-wrap">{g.application[f.name]}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                    <td className={cellCls}>
                      <StatusPill status={g.status} />
                      {g.reason && <div className="ui mt-1 text-xs text-[var(--ink-soft)]">{g.reason}</div>}
                      {g.reviewedBy && <div className="ui mt-1 text-xs text-[var(--ink-soft)]">by {g.reviewedBy}</div>}
                    </td>
                    <td className={cellCls}>
                      {g.status === "applied" && <DecisionForms action={`/api/admin/grants/${g.id}`} />}
                      {g.status === "approved" && (
                        <form method="POST" action={`/api/admin/grants/${g.id}`} className="flex items-center gap-1">
                          <input type="hidden" name="decision" value="revoked" />
                          <input name="reason" required placeholder="Reason" aria-label="Reason to revoke" className="ui w-28 border border-[var(--line-soft)] px-1.5 py-1 text-xs" />
                          <button type="submit" className="ui border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">Revoke</button>
                        </form>
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
