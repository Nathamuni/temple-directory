import { NextResponse } from "next/server";
import { checkLogin } from "@/lib/users";
import { createSessionCookie, COOKIE_NAME, SESSION_TTL_MS } from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");

  const result = checkLogin(username, password);
  if (!result.ok) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", result.reason);
    if (result.reason === "denied" && result.denyReason) {
      url.searchParams.set("denyReason", result.denyReason);
    }
    return NextResponse.redirect(url, { status: 303 });
  }

  const redirectTo = String(form.get("next") ?? "/contribute");
  const res = NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
  res.cookies.set(COOKIE_NAME, createSessionCookie(username, result.role), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
