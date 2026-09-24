import type { Metadata } from "next";
import Link from "next/link";
import { cellCls, headCls } from "@/components/account/ui";
import { requireAdmin } from "@/lib/authz";
import { readAudit } from "@/lib/store/audit";

export const metadata: Metadata = { title: "Audit log — Temple Directory" };

export default async function AuditPage() {
  await requireAdmin("/admin/audit");
  const entries = readAudit(300);
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <p className="ui text-sm"><Link href="/admin" className="underline">← Admin console</Link></p>
      <h1 className="text-2xl">Audit log</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">Newest first, last 300 entries. Append-only.</p>
      {entries.length === 0 ? (
        <p className="ui mt-6 text-sm text-[var(--ink-soft)]">No decisions recorded yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr className={headCls}><th className={cellCls}>When</th><th className={cellCls}>Who</th><th className={cellCls}>Action</th><th className={cellCls}>Target</th><th className={cellCls}>Detail</th></tr></thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className={`${cellCls} whitespace-nowrap`}>{new Date(e.at).toLocaleString()}</td>
                  <td className={cellCls}>{e.actor}</td>
                  <td className={cellCls}><code>{e.action}</code></td>
                  <td className={`${cellCls} break-all`}>{e.target}</td>
                  <td className={`${cellCls} max-w-[360px]`}>{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
