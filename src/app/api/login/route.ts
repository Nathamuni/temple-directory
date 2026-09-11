import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, newSessionPayload, signSession, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }
  const role = await verifyPassword(username, password);
  if (!role) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  const token = await signSession(newSessionPayload(username, role));
  const res = NextResponse.json({ username, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
  return res;
}
