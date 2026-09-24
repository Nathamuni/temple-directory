import { NextResponse } from "next/server";
import { getViewer } from "@/lib/authz";
import { setUserStatus } from "@/lib/store/accounts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: "Admin login required." }, { status: 403 });

  const { id } = await params;
  const form = await request.formData();
  const status = String(form.get("status") ?? "");
  const url = new URL("/admin/users", request.url);
  try {
    if (status !== "active" && status !== "suspended") throw new Error(`Invalid status "${status}"`);
    setUserStatus(id, status, viewer.username, String(form.get("reason") ?? ""));
  } catch (error) {
    url.searchParams.set("error", (error as Error).message);
  }
  return NextResponse.redirect(url, { status: 303 });
}
