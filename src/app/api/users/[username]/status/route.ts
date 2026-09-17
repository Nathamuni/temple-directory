import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { reviewContributorRequest } from "@/lib/users";

export async function POST(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin login required." }, { status: 403 });
  }

  const { username } = await params;
  const form = await request.formData();
  const decision = String(form.get("decision") ?? "");
  const denyReason = String(form.get("denyReason") ?? "").trim();

  if (decision !== "approved" && decision !== "denied") {
    return NextResponse.json({ error: `Invalid decision "${decision}"` }, { status: 400 });
  }

  const url = new URL("/admin/contributor-requests", request.url);
  try {
    reviewContributorRequest(username, decision, session.username, denyReason || undefined);
  } catch (e) {
    url.searchParams.set("error", (e as Error).message);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.redirect(url, { status: 303 });
}
