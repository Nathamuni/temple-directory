import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (req.nextUrl.pathname === "/contribute") {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", "/contribute");
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (req.nextUrl.pathname === "/api/temples") {
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (req.method === "PATCH" && session.role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/contribute", "/api/temples"],
};
