import { NextResponse } from "next/server";
import { getViewer } from "@/lib/authz";
import { reviewCorrection } from "@/lib/store/corrections";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: "Admin login required." }, { status: 403 });

  const { id } = await params;
  const form = await request.formData();
  const decision = String(form.get("decision") ?? "");
  const url = new URL("/admin/corrections", request.url);
  try {
    if (decision !== "resolved" && decision !== "dismissed") throw new Error(`Invalid decision "${decision}"`);
    reviewCorrection(id, decision, viewer.username, String(form.get("response") ?? ""));
  } catch (error) {
    url.searchParams.set("error", (error as Error).message);
  }
  return NextResponse.redirect(url, { status: 303 });
}
