import { NextResponse } from "next/server";
import { createUser, signupProblem } from "@/lib/store/accounts";
import { safeNext } from "@/lib/authz";
import { createSessionCookie, COOKIE_NAME, SESSION_TTL_MS } from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const get = (key: string) => String(form.get(key) ?? "").trim();
  const next = safeNext(form.get("next"));
  const input = {
    name: get("name"),
    phone: get("phone"),
    email: get("email"),
    city: get("city"),
    language: get("language"),
    username: get("username"),
    // Passwords are not trimmed: leading/trailing spaces are the user's choice.
    password: String(form.get("password") ?? ""),
    confirmPassword: String(form.get("confirmPassword") ?? ""),
  };

  const problem = signupProblem(input);
  if (problem) {
    const url = new URL("/signup", request.url);
    url.searchParams.set("error", problem);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  }

  const user = createUser(input);
  const res = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  res.cookies.set(COOKIE_NAME, createSessionCookie(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
