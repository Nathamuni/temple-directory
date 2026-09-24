import { NextResponse } from "next/server";
import { getViewer } from "@/lib/authz";
import { reviewGrant, revokeGrant } from "@/lib/store/accounts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: "Admin login required." }, { status: 403 });

  const { id } = await params;
  const form = await request.formData();
  const decision = String(form.get("decision") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const url = new URL("/admin/applications", request.url);
  try {
    if (decision === "approved" || decision === "rejected") reviewGrant(id, decision, viewer.username, reason);
    else if (decision === "revoked") revokeGrant(id, viewer.username, reason);
    else throw new Error(`Invalid decision "${decision}"`);
  } catch (error) {
    url.searchParams.set("error", (error as Error).message);
  }
  return NextResponse.redirect(url, { status: 303 });
}
