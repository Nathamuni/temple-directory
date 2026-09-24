import { NextResponse } from "next/server";
import { checkLogin } from "@/lib/store/accounts";
import { safeNext } from "@/lib/authz";
import { createSessionCookie, COOKIE_NAME, SESSION_TTL_MS } from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));

  const result = checkLogin(username, password);
  if (!result.ok) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", result.reason);
    url.searchParams.set("next", next);
    if (result.reason === "suspended" && result.detail) url.searchParams.set("detail", result.detail);
    return NextResponse.redirect(url, { status: 303 });
  }

  const res = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  res.cookies.set(COOKIE_NAME, createSessionCookie(result.user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
