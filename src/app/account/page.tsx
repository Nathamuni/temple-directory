import type { Metadata } from "next";
import Link from "next/link";
import { Notice, StatusPill, cellCls, headCls } from "@/components/account/ui";
import { requireViewer } from "@/lib/authz";
import { AREA_LABEL } from "@/lib/fieldAuthority";
import { GRANT_ROLES, ROLE_LABEL, isTempleScoped } from "@/lib/roles";
import { getUser, grantsForUser } from "@/lib/store/accounts";
import { listCorrections } from "@/lib/store/corrections";
import { followedTemples } from "@/lib/store/follows";
import { listRevisions } from "@/lib/store/revisions";
import { getTemple } from "@/lib/temples";

export const metadata: Metadata = { title: "My account — Temple Directory" };

function templeName(slug: string | null): string {
  if (!slug) return "";
  return getTemple(slug)?.identity.nameEn ?? slug;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-8">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  );
}

const muted = "ui text-sm text-[var(--ink-soft)]";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ applied?: string; suggested?: string; followed?: string }> }) {
  const viewer = await requireViewer("/account");
  const { applied, suggested, followed } = await searchParams;
  const user = getUser(viewer.id)!;
  const allGrants = grantsForUser(viewer.id);
  const approved = viewer.grants;
  const following = followedTemples(viewer.id).map((slug) => ({ slug, name: templeName(slug) }));
  const myRevisions = listRevisions().filter((r) => r.submittedBy === viewer.username).reverse();
  const myCorrections = listCorrections().filter((c) => c.submittedBy === viewer.username).reverse();
  const authorityGrants = approved.filter((g) => g.role === "temple_management" || g.role === "priest");
  const sevaGrants = approved.filter((g) => g.role === "seva_coordinator");

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <h1 className="text-2xl">My Temple Directory</h1>
      <p className={muted}>
        Signed in as <strong>{viewer.username}</strong>
        {" · "}roles: Devotee
        {approved.map((g) => `, ${ROLE_LABEL[g.role]}${g.templeSlug ? ` — ${templeName(g.templeSlug)}` : ""}`).join("")}
        {viewer.isAdmin && ", Platform Admin"}
      </p>
      {applied && <Notice tone="ok">Application submitted. An admin will review it — its status shows below.</Notice>}
      {suggested && <Notice tone="ok">Thank you — your correction is with the editors.</Notice>}
      {followed && <Notice tone="ok">Following — the temple is listed under My Temples.</Notice>}

      <nav className="ui mt-4 flex flex-wrap gap-3 text-sm">
        <a href="#account" className="underline">My Account</a>
        <a href="#temples" className="underline">My Temples</a>
        <a href="#contributions" className="underline">My Contributions</a>
        <a href="#corrections" className="underline">My Corrections</a>
        <a href="#roles" className="underline">Roles</a>
        {(approved.length > 0 || viewer.isAdmin) && <a href="#tools" className="underline">Role tools</a>}
      </nav>

      <Section id="account" title="My Account">
        <dl className="ui grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-semibold">Name</dt><dd className="m-0">{user.name}</dd>
          <dt className="font-semibold">Email</dt><dd className="m-0">{user.email || "—"}</dd>
          <dt className="font-semibold">Mobile</dt><dd className="m-0">{user.phone || "—"}</dd>
          <dt className="font-semibold">City</dt><dd className="m-0">{user.city || "—"}</dd>
          <dt className="font-semibold">Language</dt><dd className="m-0">{user.language || "—"}</dd>
        </dl>
      </Section>

      {(approved.length > 0 || viewer.isAdmin) && (
        <Section id="tools" title="Role tools">
          <ul className="ui m-0 list-none space-y-2 p-0 text-sm">
            {viewer.isAdmin && (
              <li><Link href="/admin" className="underline">Admin console</Link> — applications, submissions, revisions, corrections, users, audit log</li>
            )}
            {approved.some((g) => g.role === "contributor") && (
              <li>
                <Link href="/contribute" className="underline">Contributor workspace</Link> — add a temple ·{" "}
                <Link href="/my-submissions" className="underline">my submissions</Link> · propose edits from any temple page
              </li>
            )}
            {authorityGrants.map((g) => (
              <li key={g.id}>
                <strong>{ROLE_LABEL[g.role]}</strong> — {templeName(g.templeSlug)}:{" "}
                <Link href={`/temple/${g.templeSlug}/propose?as=${g.role}`} className="underline">
                  update or confirm {g.role === "priest" ? "worship & ritual" : "official"} information
                </Link>
              </li>
            ))}
            {sevaGrants.map((g) => (
              <li key={g.id}>
                <strong>Seva coordination</strong> — {templeName(g.templeSlug)}: volunteer requirements, availability
                and assignments arrive in the next release.
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="temples" title="My Temples">
        {following.length === 0 ? (
          <p className={muted}>You aren&apos;t following any temples yet — use “Follow” on a temple page.</p>
        ) : (
          <ul className="ui m-0 list-disc pl-5 text-sm">
            {following.map((t) => (
              <li key={t.slug} className="flex flex-wrap items-center gap-2">
                <Link href={`/temple/${t.slug}`} className="underline">{t.name}</Link>
                <form method="POST" action={`/api/temples/${t.slug}/follow`}>
                  <input type="hidden" name="follow" value="0" />
                  <input type="hidden" name="back" value="/account#temples" />
                  <button type="submit" className="text-xs underline text-[var(--ink-soft)]">Unfollow</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="contributions" title="My Contributions">
        <p className={muted}>
          New temples you submitted are on <Link href="/my-submissions" className="underline">My Submissions</Link>.
          Changes you proposed to live temples:
        </p>
        {myRevisions.length === 0 ? (
          <p className={muted}>None yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead><tr className={headCls}><th className={cellCls}>Temple</th><th className={cellCls}>As</th><th className={cellCls}>Sections</th><th className={cellCls}>Status</th></tr></thead>
              <tbody>
                {myRevisions.map((r) => (
                  <tr key={r.id}>
                    <td className={cellCls}><Link href={`/temple/${r.templeSlug}`}>{templeName(r.templeSlug)}</Link></td>
                    <td className={cellCls}>{ROLE_LABEL[r.actingRole]}</td>
                    <td className={cellCls}>{[...new Set([...r.changedAreas, ...r.confirmedAreas])].map((a) => AREA_LABEL[a]).join(", ")}</td>
                    <td className={cellCls}><StatusPill status={r.status} />{r.reason && <div className="ui mt-1 text-xs text-[var(--ink-soft)]">{r.reason}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="corrections" title="My Corrections">
        {myCorrections.length === 0 ? (
          <p className={muted}>None yet — every temple page has a “Suggest a correction” link.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead><tr className={headCls}><th className={cellCls}>Temple</th><th className={cellCls}>About</th><th className={cellCls}>Your note</th><th className={cellCls}>Status</th></tr></thead>
              <tbody>
                {myCorrections.map((c) => (
                  <tr key={c.id}>
                    <td className={cellCls}><Link href={`/temple/${c.templeSlug}`}>{templeName(c.templeSlug)}</Link></td>
                    <td className={cellCls}>{c.section}</td>
                    <td className={`${cellCls} max-w-[320px]`}>{c.message}</td>
                    <td className={cellCls}><StatusPill status={c.status} />{c.response && <div className="ui mt-1 text-xs text-[var(--ink-soft)]">{c.response}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {!viewer.isAdmin && (
        <Section id="roles" title="Roles & applications">
          {allGrants.length > 0 && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead><tr className={headCls}><th className={cellCls}>Role</th><th className={cellCls}>Temple</th><th className={cellCls}>Applied</th><th className={cellCls}>Status</th></tr></thead>
                <tbody>
                  {allGrants.map((g) => (
                    <tr key={g.id}>
                      <td className={cellCls}>{ROLE_LABEL[g.role]}</td>
                      <td className={cellCls}>{templeName(g.templeSlug) || "All temples"}</td>
                      <td className={cellCls}>{new Date(g.appliedAt).toLocaleDateString()}</td>
                      <td className={cellCls}><StatusPill status={g.status} />{g.reason && <div className="ui mt-1 text-xs text-[var(--ink-soft)]">Reason: {g.reason}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={`${muted} mt-3`}>Apply for a role — an admin reviews every application:</p>
          <ul className="ui m-0 list-disc pl-5 text-sm">
            {GRANT_ROLES.map((role) => (
              <li key={role}>
                <Link href={`/apply/${role}`} className="underline">{ROLE_LABEL[role]}</Link>
                {isTempleScoped(role) && <span className="text-[var(--ink-soft)]"> (for one temple)</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
