import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { updateTempleStatus } from "@/lib/temples";
import type { TempleStatus } from "@/lib/types";

const VALID: TempleStatus[] = ["draft", "pending", "verified", "published", "rejected"];

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin login required." }, { status: 403 });
  }

  const { slug } = await params;
  const form = await request.formData();
  const next = String(form.get("status") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!VALID.includes(next as TempleStatus)) {
    return NextResponse.json({ error: `Invalid status "${next}"` }, { status: 400 });
  }

  const url = new URL("/status", request.url);
  const result = updateTempleStatus(slug, next as TempleStatus, reason || undefined);
  if (!result.ok) {
    // The publish gate returns its blockers rather than throwing, so the admin
    // sees which fields are missing instead of a 500.
    const detail = result.blockers?.length
      ? `${result.error}: ${result.blockers
          .slice(0, 6)
          .map((b) => b.column || b.path)
          .join(", ")}${result.blockers.length > 6 ? ` and ${result.blockers.length - 6} more` : ""}`
      : (result.error ?? "Could not update this entry.");
    url.searchParams.set("error", detail);
  }
  return NextResponse.redirect(url, { status: 303 });
}
