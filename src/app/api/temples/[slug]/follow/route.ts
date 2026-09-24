import { NextResponse } from "next/server";
import { getViewer, safeNext } from "@/lib/authz";
import { setFollow } from "@/lib/store/follows";
import { getTemple } from "@/lib/temples";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL(`/login?next=/temple/${slug}`, request.url), { status: 303 });
  if (getTemple(slug)?.status !== "published") return NextResponse.json({ error: "Temple not found." }, { status: 404 });

  const form = await request.formData();
  setFollow(viewer.id, slug, String(form.get("follow")) === "1");
  const back = safeNext(form.get("back"), "/account?followed=1#temples");
  return NextResponse.redirect(new URL(back, request.url), { status: 303 });
}
