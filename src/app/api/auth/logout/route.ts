import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/session";

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
