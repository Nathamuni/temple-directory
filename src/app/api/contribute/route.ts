import { NextResponse } from "next/server";
import { getViewer, hasRole } from "@/lib/authz";
import { createDraftTemple } from "@/lib/temples";
import { validateTemple } from "@/lib/validate";
import type { Temple } from "@/lib/types";

/**
 * Accepts a full Temple draft as JSON — the same shape the Excel importer
 * produces — so both paths run the identical validator.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: "Log in to contribute." }, { status: 401 });
  }
  if (viewer.isAdmin) {
    return NextResponse.json(
      { ok: false, error: "Admins review submissions rather than authoring them." },
      { status: 403 }
    );
  }
  if (!hasRole(viewer, "contributor")) {
    return NextResponse.json(
      { ok: false, error: "Contributor access is needed — apply from your account page." },
      { status: 403 }
    );
  }

  let draft: Temple;
  try {
    draft = (await request.json()) as Temple;
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read the submission." }, { status: 400 });
  }

  if (!draft?.identity?.nameEn?.trim()) {
    return NextResponse.json({ ok: false, error: "A temple name is required." }, { status: 400 });
  }

  // A draft is incomplete by definition, so validation errors do not block the
  // save — they are what the readiness panel and the publish gate act on.
  const errors = validateTemple(draft).filter((i) => i.level === "error");
  const temple = createDraftTemple(draft, viewer.username);

  return NextResponse.json({ ok: true, slug: temple.slug, remainingErrors: errors.length });
}
