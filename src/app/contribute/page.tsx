import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import TempleForm from "@/components/contribute/TempleForm";

export const metadata: Metadata = { title: "Contribute a Temple" };

export default async function ContributePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/contribute");
  // Admins review; they do not author, so the editorial pipeline stays honest.
  if (session.role === "admin") redirect("/status");

  return <TempleForm action="/api/contribute" submitLabel="Submit draft for review" />;
}
