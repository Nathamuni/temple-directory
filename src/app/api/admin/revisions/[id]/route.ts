import { NextResponse } from "next/server";
import { getViewer } from "@/lib/authz";
import { reviewRevision } from "@/lib/store/revisions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: "Admin login required." }, { status: 403 });

  const { id } = await params;
  const form = await request.formData();
  const decision = String(form.get("decision") ?? "");
  const url = new URL("/admin/revisions", request.url);
  try {
    if (decision !== "approved" && decision !== "rejected") throw new Error(`Invalid decision "${decision}"`);
    const result = reviewRevision(id, decision, viewer.username, String(form.get("reason") ?? ""));
    if (result.status === "conflict") url.searchParams.set("error", result.reason ?? "Conflict.");
  } catch (error) {
    url.searchParams.set("error", (error as Error).message);
  }
  return NextResponse.redirect(url, { status: 303 });
}
