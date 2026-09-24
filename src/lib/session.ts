/**
 * Session handling — a signed, tamper-proof cookie naming the account.
 * The signature (HMAC-SHA256, keyed by SESSION_SECRET) stops a visitor from
 * hand-editing their cookie to become someone else. Roles are deliberately NOT
 * in the cookie: src/lib/authz.ts loads them per request, so an approval,
 * revocation or suspension takes effect on the very next page load.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export interface SessionPayload {
  uid: string;
  exp: number; // epoch ms
}

const COOKIE_NAME = "td_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set — add it to .env.local");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionCookie(uid: string): string {
  const payload: SessionPayload = { uid, exp: Date.now() + SESSION_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionCookie(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    // Cookies from before per-request roles carried a username instead.
    if (typeof payload.uid !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionCookie(store.get(COOKIE_NAME)?.value);
}

export { COOKIE_NAME, SESSION_TTL_MS };
