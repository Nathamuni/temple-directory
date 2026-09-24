import { redirect } from "next/navigation";

/** Superseded: everyone signs up as a devotee, then applies for contributor access. */
export default function RequestAccessPage() {
  redirect("/signup?next=/apply/contributor");
}
