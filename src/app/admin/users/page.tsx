import type { Metadata } from "next";
import Link from "next/link";
import { Notice, StatusPill, cellCls, headCls } from "@/components/account/ui";
import { requireAdmin } from "@/lib/authz";
import { ROLE_LABEL } from "@/lib/roles";
import { grantsForUser, listUsers } from "@/lib/store/accounts";
import { getTemple } from "@/lib/temples";

export const metadata: Metadata = { title: "Users — Temple Directory" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("/admin/users");
  const { error } = await searchParams;
  const users = listUsers();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <p className="ui text-sm"><Link href="/admin" className="underline">← Admin console</Link></p>
      <h1 className="text-2xl">Users</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Suspending blocks login and every role at once, from the next request. To remove one role,
        revoke it on <Link href="/admin/applications" className="underline">Role applications</Link>.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr className={headCls}><th className={cellCls}>Account</th><th className={cellCls}>Contact</th><th className={cellCls}>Roles</th><th className={cellCls}>Status</th><th className={cellCls}>Action</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const roles = grantsForUser(u.id).filter((g) => g.status === "approved");
              const builtIn = u.id.startsWith("builtin:");
              return (
                <tr key={u.id}>
                  <td className={cellCls}><strong>{u.username}</strong><div className="ui text-xs text-[var(--ink-soft)]">{u.name}{builtIn && " · built-in"}</div></td>
                  <td className={cellCls}><div className="ui text-xs">{u.email || "—"}<br />{u.phone}{u.city && <><br />{u.city}</>}</div></td>
                  <td className={cellCls}>
                    <div className="ui text-xs">
                      {u.isAdmin ? "Platform Admin" : "Devotee"}
                      {roles.map((g) => (
                        <div key={g.id}>{ROLE_LABEL[g.role]}{g.templeSlug && ` — ${getTemple(g.templeSlug)?.identity.nameEn ?? g.templeSlug}`}</div>
                      ))}
                    </div>
                  </td>
                  <td className={cellCls}><StatusPill status={u.status} />{u.suspendedReason && <div className="ui mt-1 text-xs text-[var(--ink-soft)]">{u.suspendedReason}</div>}</td>
                  <td className={cellCls}>
                    {!builtIn && (u.status === "active" ? (
                      <form method="POST" action={`/api/admin/users/${u.id}`} className="flex items-center gap-1">
                        <input type="hidden" name="status" value="suspended" />
                        <input name="reason" required placeholder="Reason" aria-label="Reason to suspend" className="ui w-28 border border-[var(--line-soft)] px-1.5 py-1 text-xs" />
                        <button type="submit" className="ui border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">Suspend</button>
                      </form>
                    ) : (
                      <form method="POST" action={`/api/admin/users/${u.id}`}>
                        <input type="hidden" name="status" value="active" />
                        <button type="submit" className="ui border border-[var(--line-soft)] bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">Reactivate</button>
                      </form>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
