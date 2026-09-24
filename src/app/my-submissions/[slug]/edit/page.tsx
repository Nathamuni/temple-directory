import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hasRole, requireViewer } from "@/lib/authz";
import { getTemple } from "@/lib/temples";
import TempleForm from "@/components/contribute/TempleForm";

export const metadata: Metadata = { title: "Edit submission" };

/** Only a draft or a rejected entry is still the contributor's to revise. */
const EDITABLE = ["draft", "rejected"];

export default async function EditSubmissionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await requireViewer(`/my-submissions/${slug}/edit`);
  if (!hasRole(viewer, "contributor")) redirect("/apply/contributor");

  const temple = getTemple(slug);
  if (!temple) notFound();
  if (temple.submittedBy !== viewer.username) notFound();
  if (!EDITABLE.includes(temple.status)) redirect("/my-submissions");

  return (
    <>
      {temple.status === "rejected" && temple.rejectionReason && (
        <div className="mx-auto max-w-[1440px] px-3 pt-6 sm:px-6">
          <div className="alert">
            <span aria-hidden>↩</span>
            <div>
              <b>Sent back for revision.</b> {temple.rejectionReason}
            </div>
          </div>
        </div>
      )}
      <TempleForm
        initial={temple}
        action={`/api/temples/${slug}/edit`}
        submitLabel="Resubmit for review"
      />
    </>
  );
}
