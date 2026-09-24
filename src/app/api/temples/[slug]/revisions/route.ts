import { NextResponse } from "next/server";
import { getViewer, hasRole } from "@/lib/authz";
import type { Area } from "@/lib/fieldAuthority";
import { isGrantRole } from "@/lib/roles";
import { proposeRevision, RevisionError } from "@/lib/store/revisions";
import type { Temple } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "Log in to propose a change." }, { status: 401 });

  const { slug } = await params;
  const as = new URL(request.url).searchParams.get("as") ?? "";
  if (!isGrantRole(as)) return NextResponse.json({ ok: false, error: "Unknown role." }, { status: 400 });
  // The role must be held for THIS temple (contributor is global).
  if (!hasRole(viewer, as, as === "contributor" ? undefined : slug)) {
    return NextResponse.json({ ok: false, error: "You do not hold that role for this temple." }, { status: 403 });
  }

  let body: { proposed?: Temple; confirmedAreas?: Area[]; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read the change." }, { status: 400 });
  }
  if (!body.proposed?.identity?.nameEn?.trim()) {
    return NextResponse.json({ ok: false, error: "A temple name is required." }, { status: 400 });
  }

  try {
    const revision = proposeRevision({
      templeSlug: slug,
      proposed: body.proposed,
      actingRole: as,
      submittedBy: viewer.username,
      confirmedAreas: Array.isArray(body.confirmedAreas) ? body.confirmedAreas : [],
      note: typeof body.note === "string" ? body.note.slice(0, 1000) : undefined,
    });
    return NextResponse.json({ ok: true, id: revision.id });
  } catch (error) {
    const status = error instanceof RevisionError ? error.status : 400;
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status });
  }
}
