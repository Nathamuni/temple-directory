import { redirect } from "next/navigation";

/** Superseded by the all-roles application queue. */
export default function ContributorRequestsPage() {
  redirect("/admin/applications");
}
