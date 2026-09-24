import { NextResponse } from "next/server";
import { getViewer } from "@/lib/authz";
import { CORRECTION_SECTIONS, submitCorrection } from "@/lib/store/corrections";
import { getTemple } from "@/lib/temples";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.redirect(new URL(`/login?next=/temple/${slug}/suggest`, request.url), { status: 303 });
  }
  const temple = getTemple(slug);
  if (!temple || temple.status !== "published") return NextResponse.json({ error: "Temple not found." }, { status: 404 });

  const form = await request.formData();
  const kind = String(form.get("kind") ?? "correction") === "observation" ? "observation" : "correction";
  const section = String(form.get("section") ?? "");
  const message = String(form.get("message") ?? "").slice(0, 2000);
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim();

  const back = new URL(`/temple/${slug}/suggest`, request.url);
  const fail = (m: string) => {
    back.searchParams.set("error", m);
    return NextResponse.redirect(back, { status: 303 });
  };
  if (!CORRECTION_SECTIONS.includes(section)) return fail("Choose which part of the page this is about.");
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return fail("The source link must start with http:// or https://");

  try {
    submitCorrection({ templeSlug: slug, kind, section, message, sourceUrl: sourceUrl || undefined, submittedBy: viewer.username });
  } catch (error) {
    return fail((error as Error).message);
  }
  return NextResponse.redirect(new URL("/account?suggested=1#corrections", request.url), { status: 303 });
}
