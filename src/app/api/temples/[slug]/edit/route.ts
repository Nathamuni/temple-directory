import { NextResponse } from "next/server";
import { getViewer, hasRole } from "@/lib/authz";
import { updateDraftTemple } from "@/lib/temples";
import type { Temple } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: "Log in to edit a submission." }, { status: 401 });
  }
  if (!hasRole(viewer, "contributor")) {
    return NextResponse.json({ ok: false, error: "Contributor access is needed to edit." }, { status: 403 });
  }

  const { slug } = await params;
  let draft: Temple;
  try {
    draft = (await request.json()) as Temple;
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read the submission." }, { status: 400 });
  }

  if (!draft?.identity?.nameEn?.trim()) {
    return NextResponse.json({ ok: false, error: "A temple name is required." }, { status: 400 });
  }

  try {
    // Ownership and editable-status are enforced inside updateDraftTemple.
    const temple = updateDraftTemple(slug, viewer.username, draft);
    return NextResponse.json({ ok: true, slug: temple.slug });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
