import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasRole, requireViewer } from "@/lib/authz";
import TempleForm from "@/components/contribute/TempleForm";

export const metadata: Metadata = { title: "Contribute a Temple" };

export default async function ContributePage() {
  const viewer = await requireViewer("/contribute");
  // Admins review; they do not author, so the editorial pipeline stays honest.
  if (viewer.isAdmin) redirect("/status");
  if (!hasRole(viewer, "contributor")) redirect("/apply/contributor");

  return <TempleForm action="/api/contribute" submitLabel="Submit draft for review" />;
}
