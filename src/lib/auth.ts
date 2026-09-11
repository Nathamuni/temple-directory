// src/lib/auth.ts
// Prototype auth: two hardcoded example accounts, HMAC-signed session cookie.
// No database. Password hashing is sha256(password + secret), NOT bcrypt —
// acceptable only for these two demo accounts, not real user data.

export type Role = "contributor" | "admin";

export interface SessionPayload {
  username: string;
  role: Role;
  exp: number;
}

interface Account {
  username: string;
  role: Role;
  passwordHashEnv: string;
}

const ACCOUNTS: Account[] = [
  { username: "contributor", role: "contributor", passwordHashEnv: "CONTRIBUTOR_PASSWORD_HASH" },
  { username: "admin", role: "admin", passwordHashEnv: "ADMIN_PASSWORD_HASH" },
];

export const SESSION_COOKIE = "temple_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const pad = (4 - (value.length % 4)) % 4;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = requireEnv("SESSION_SECRET");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Not constant-time, not salted per-user — fine for two hardcoded demo accounts. */
export async function verifyPassword(username: string, password: string): Promise<Role | null> {
  const account = ACCOUNTS.find((a) => a.username === username);
  if (!account) return null;
  const expected = requireEnv(account.passwordHashEnv);
  const secret = requireEnv("SESSION_SECRET");
  const actual = await sha256Hex(`${password}:${secret}`);
  return actual === expected ? account.role : null;
}

export function newSessionPayload(username: string, role: Role): SessionPayload {
  return { username, role, exp: Date.now() + SESSION_TTL_MS };
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sig),
      new TextEncoder().encode(body)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
