import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { adminQueues } from "@/lib/adminQueue";

export const metadata: Metadata = { title: "Admin console — Temple Directory" };

export default async function AdminPage() {
  await requireAdmin("/admin");
  const q = adminQueues();
  const tiles = [
    { href: "/admin/applications", title: "Role applications", count: q.applications, blurb: "Contributor, temple management, priest and seva coordinator applications." },
    { href: "/status", title: "Temple submissions", count: q.submissions, blurb: "New temples from contributors and imports: review, verify, publish or reject." },
    { href: "/admin/revisions", title: "Proposed changes", count: q.revisions, blurb: "Edits to live temples, shown field by field before they go public." },
    { href: "/admin/corrections", title: "Corrections", count: q.corrections, blurb: "Devotee corrections and observations to act on." },
    { href: "/admin/users", title: "Users", count: null, blurb: "Every account and its roles. Suspend accounts, revoke roles." },
    { href: "/admin/audit", title: "Audit log", count: null, blurb: "Every approval, rejection, revocation and suspension." },
    { href: "/admin/bulk-import", title: "Bulk import / export", count: null, blurb: "Excel round trip for the whole directory." },
  ];
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <h1 className="text-2xl">Admin console</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">Nothing reaches the public site, and no role takes effect, until it is approved here.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="block rounded-xl border border-[var(--line-soft)] bg-[var(--paper-soft)] p-4 hover:no-underline">
            <div className="flex items-baseline justify-between gap-2">
              <strong>{t.title}</strong>
              {t.count !== null && (
                <span className={`ui rounded-full px-2 text-xs font-bold ${t.count > 0 ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-600"}`}>
                  {t.count} waiting
                </span>
              )}
            </div>
            <p className="ui mt-1 mb-0 text-sm text-[var(--ink-soft)]">{t.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
