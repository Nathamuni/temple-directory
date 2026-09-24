import { NextResponse } from "next/server";
import { getViewer } from "@/lib/authz";
import { APPLICATION_FIELDS, isGrantRole, isTempleScoped } from "@/lib/roles";
import { applyForRole } from "@/lib/store/accounts";
import { getTemple } from "@/lib/temples";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL("/login?next=/account", request.url), { status: 303 });

  const form = await request.formData();
  const role = String(form.get("role") ?? "");
  if (!isGrantRole(role)) return NextResponse.json({ error: `Unknown role "${role}"` }, { status: 400 });

  const back = new URL(`/apply/${role}`, request.url);
  const fail = (message: string) => {
    back.searchParams.set("error", message);
    return NextResponse.redirect(back, { status: 303 });
  };

  const templeSlug = String(form.get("templeSlug") ?? "").trim() || null;
  if (isTempleScoped(role)) {
    const temple = templeSlug ? getTemple(templeSlug) : undefined;
    if (!temple || temple.status !== "published") return fail("Choose a temple from the list.");
  }

  const application: Record<string, string> = {};
  for (const field of APPLICATION_FIELDS[role]) {
    const value = String(form.get(field.name) ?? "").trim().slice(0, 2000);
    if (field.required && !value) return fail(`"${field.label}" is required.`);
    if (value) application[field.name] = value;
  }

  try {
    applyForRole(viewer.id, role, templeSlug, application);
  } catch (error) {
    return fail((error as Error).message);
  }
  return NextResponse.redirect(new URL("/account?applied=1", request.url), { status: 303 });
}
