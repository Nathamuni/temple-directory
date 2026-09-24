import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TempleForm from "@/components/contribute/TempleForm";
import { Notice } from "@/components/account/ui";
import { hasRole, requireViewer } from "@/lib/authz";
import { EDITABLE_AREAS, VOUCHED_AREAS } from "@/lib/fieldAuthority";
import { ROLE_LABEL, isGrantRole, type GrantRole } from "@/lib/roles";
import { getTemple } from "@/lib/temples";

export const metadata: Metadata = { title: "Propose a change" };

/**
 * Edit a live temple as a contributor, temple management or priest. Nothing
 * here touches the public page: it creates a revision for admin review.
 */
export default async function ProposePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { slug } = await params;
  const { as } = await searchParams;
  const viewer = await requireViewer(`/temple/${slug}/propose${as ? `?as=${as}` : ""}`);
  const temple = getTemple(slug);
  if (!temple || temple.status !== "published") notFound();

  // Prefer the most authoritative role the viewer holds for this temple.
  const candidates: GrantRole[] = ["temple_management", "priest", "contributor"];
  const requested = as && isGrantRole(as) ? as : undefined;
  const holds = (role: GrantRole) => hasRole(viewer, role, role === "contributor" ? undefined : slug);
  const role = requested && holds(requested) ? requested : candidates.find(holds);

  if (!role) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-14">
        <h1 className="text-2xl">Propose a change</h1>
        <Notice tone="info">
          Editing a live temple needs an approved role: contributor, or temple management / priest
          for this temple. Spotted something wrong?{" "}
          <Link href={`/temple/${slug}/suggest`} className="underline">Suggest a correction</Link> instead —
          no role needed.
        </Notice>
        <p className="ui mt-3 text-sm">
          <Link href="/account#roles" className="underline">Apply for a role</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-[1440px] px-3 pt-6 sm:px-6">
        <div className="alert">
          <span aria-hidden>✎</span>
          <div>
            Proposing a change to <b>{temple.identity.nameEn}</b> as <b>{ROLE_LABEL[role]}</b>. The
            public page is unchanged until an admin approves it.
            {role !== "contributor" && " Only the sections your role is responsible for are shown."}
          </div>
        </div>
      </div>
      <TempleForm
        initial={temple}
        action={`/api/temples/${slug}/revisions?as=${role}`}
        submitLabel="Send change for review"
        editableAreas={role === "contributor" ? undefined : EDITABLE_AREAS[role]}
        confirmableAreas={VOUCHED_AREAS[role] ?? []}
        revision
        doneHref="/account#contributions"
      />
    </>
  );
}
