import { NextResponse } from "next/server";
import { submitContributorRequest, usernameTaken } from "@/lib/users";

export async function POST(request: Request) {
  const form = await request.formData();
  const get = (key: string) => String(form.get(key) ?? "").trim();

  const name = get("name");
  const phone = get("phone");
  const email = get("email");
  const username = get("username");
  const password = get("password");
  const confirmPassword = get("confirmPassword");
  const reason = get("reason") || undefined;

  const url = new URL("/request-access", request.url);
  const fail = (message: string) => {
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (name.length < 2) return fail("Full name is required.");
  if (phone.length < 7) return fail("A valid phone number is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("A valid email address is required.");
  if (username.length < 3) return fail("Username must be at least 3 characters.");
  if (password.length < 8) return fail("Password must be at least 8 characters.");
  if (password !== confirmPassword) return fail("Passwords do not match.");
  if (usernameTaken(username)) return fail(`Username "${username}" is already taken or already requested.`);

  submitContributorRequest({ username, password, name, phone, email, reason });

  url.searchParams.delete("error");
  url.searchParams.set("submitted", "1");
  return NextResponse.redirect(url, { status: 303 });
}
