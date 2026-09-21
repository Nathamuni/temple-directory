# Contributor Login + Temple Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in contributor submit a new temple as a draft through a web form, and let an admin advance a temple's editorial status, without adding a database — the directory stays file-based JSON under `data/temples/`.

**Architecture:** A hand-rolled, dependency-free auth layer (Web Crypto HMAC-signed cookie, two hardcoded example accounts) gates a new `/contribute` page and the mutation endpoints of a new `/api/temples` route. Submissions are validated server-side, converted into a `Temple` object matching the existing schema (`status: "draft"`, `stub: true`), and written directly to `data/temples/<slug>.json`, reusing the existing `slugify` helper and invalidating the existing in-memory cache in `src/lib/temples.ts` so new/updated entries render immediately.

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Tailwind v4, Web Crypto API (`crypto.subtle`) for HMAC signing and SHA-256 password hashing — no new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-09-11-contribute-login-design.md`

## Global Constraints

- No new dependencies — use only built-in Node/Web Crypto (`crypto.subtle`, `atob`/`btoa`), already-installed Next.js/React. Do not run `npm install` for this feature.
- No test harness exists in this repo and none is added for this feature — verify every task manually (dev server + `curl` + browser), per the project's existing testing policy.
- Every `Temple` object written to disk must satisfy the TypeScript `Temple` type (`src/lib/types.ts`) and the existing build-time validator (`src/lib/temples.ts`): minimum 2 references; stub entries (`stub: true`) skip the 6-step Worship SOP check.
- Visual style must match the existing Wikipedia-esque "Academic + Devotional + Neutral" look: reuse existing CSS variables/classes (`--paper`, `--paper-soft`, `--ink`, `--ink-soft`, `--line-soft`, `--accent`, `.ui`, `.wiki-h2`) — no new animation, no new UI library.
- Passwords are hashed as `sha256(password + ":" + SESSION_SECRET)`, not bcrypt/salted-per-user. This is acceptable only because there are two hardcoded example/demo accounts, not real user data — call this out in code comments, don't "fix" it by adding a hashing dependency.
- Commit steps are written into this plan for completeness, but this session's operating rules require an explicit user ask before any `git commit`. Do not run the commit steps unless the user has explicitly asked for commits during execution — leave changes uncommitted otherwise and say so.
- Quote the project path in every shell command — it contains a literal space: `"/home/nathamuni/ Projects/Temple Dir"`.

---

### Task 1: Auth core + login/logout API routes

**Files:**
- Create: `src/lib/auth.ts`
- Create: `.env.local` (gitignored — real secret values for local testing)
- Create: `.env.local.example` (committed — documents required vars, no real secrets)
- Modify: `.gitignore`
- Create: `src/app/api/login/route.ts`
- Create: `src/app/api/logout/route.ts`

**Interfaces:**
- Produces: `Role = "contributor" | "admin"`; `SessionPayload { username: string; role: Role; exp: number }`; `SESSION_COOKIE: string`; `SESSION_TTL_MS: number`; `verifyPassword(username: string, password: string): Promise<Role | null>`; `signSession(payload: SessionPayload): Promise<string>`; `verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null>`; `newSessionPayload(username: string, role: Role): SessionPayload` — all from `@/lib/auth`, used by Tasks 2, 4, 6, and `src/lib/session.ts` (Task 7).

- [ ] **Step 1: Write `src/lib/auth.ts`**

```ts
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
```

- [ ] **Step 2: Compute the example password hashes**

Run (from the project root):

```bash
cd "/home/nathamuni/ Projects/Temple Dir"
node -e '
const { subtle } = require("crypto").webcrypto;
async function sha256Hex(s) {
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Buffer.from(digest).toString("hex");
}
(async () => {
  const secret = "temple-directory-prototype-secret-2026";
  console.log("CONTRIBUTOR_PASSWORD_HASH=" + await sha256Hex("Contribute@2026:" + secret));
  console.log("ADMIN_PASSWORD_HASH=" + await sha256Hex("AdminTemple@2026:" + secret));
})();
'
```

Expected output (verified already — use these literal values in Step 3):

```
CONTRIBUTOR_PASSWORD_HASH=95183e80a6c6127dd7cdbd54c5b8c3502021325e617b375d97aaec54d62ce11a
ADMIN_PASSWORD_HASH=c3b47fdacd9dd9a1ae72beb22e7fb5e23e2fc2fecfcf7d7be0d8ef717c5235e8
```

Note: those hashes are 64 hex characters each — if the command above ever needs re-running (e.g. changing a password), reject any output that isn't exactly 64 characters.

- [ ] **Step 3: Write `.env.local`**

```
SESSION_SECRET=<generate your own; see .env.example>
CONTRIBUTOR_PASSWORD_HASH=95183e80a6c6127dd7cdbd54c5b8c3502021325e617b375d97aaec54d62ce11a
ADMIN_PASSWORD_HASH=c3b47fdacd9dd9a1ae72beb22e7fb5e23e2fc2fecfcf7d7be0d8ef717c5235e8
```

- [ ] **Step 4: Write `.env.local.example`**

```
# Copy to .env.local and fill in real values for local testing.
# Regenerate hashes with: node -e '...' (see docs/superpowers/plans/2026-09-11-contribute-login.md Task 1)
SESSION_SECRET=
CONTRIBUTOR_PASSWORD_HASH=
ADMIN_PASSWORD_HASH=
```

- [ ] **Step 5: Add `.env*.local` to `.gitignore`**

Append to `.gitignore`:

```
.env*.local
```

- [ ] **Step 6: Write `src/app/api/login/route.ts`**

```ts
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
```

- [ ] **Step 7: Write `src/app/api/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
```

- [ ] **Step 8: Manual verification**

```bash
cd "/home/nathamuni/ Projects/Temple Dir"
npm run dev &
sleep 3
curl -i -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"contributor","password":"Contribute@2026"}'
# Expected: HTTP 200, body {"username":"contributor","role":"contributor"},
# a Set-Cookie: temple_session=... header present.

curl -i -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"contributor","password":"wrong"}'
# Expected: HTTP 401, {"error":"Invalid username or password"}

curl -i -X POST http://localhost:3000/api/logout
# Expected: HTTP 200, Set-Cookie: temple_session=; Max-Age=0
```

Kill the dev server (`kill %1` or Ctrl+C) once confirmed.

- [ ] **Step 9: Commit** (only if the user has explicitly asked for commits during execution)

```bash
git add src/lib/auth.ts src/app/api/login/route.ts src/app/api/logout/route.ts .env.local.example .gitignore
git commit -m "feat: add auth core and login/logout API routes"
```

---

### Task 2: Middleware route protection

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `verifySessionToken`, `SESSION_COOKIE` from `@/lib/auth` (Task 1).
- Produces: redirects unauthenticated `/contribute` requests to `/login?next=/contribute`; returns 401/403 JSON for unauthenticated/under-privileged `/api/temples` requests. Relied on by Tasks 4–6 (defense is here; routes may also double-check defensively).

- [ ] **Step 1: Write `src/middleware.ts`**

```ts
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
```

- [ ] **Step 2: Manual verification**

```bash
cd "/home/nathamuni/ Projects/Temple Dir"
npm run dev &
sleep 3

curl -i http://localhost:3000/contribute
# Expected: HTTP 307/308 redirect, Location: /login?next=%2Fcontribute

curl -i -X POST http://localhost:3000/api/temples -d '{}' -H "Content-Type: application/json"
# Expected: HTTP 401, {"error":"Authentication required"}

# Log in as contributor with a cookie jar, then confirm /contribute is reachable
curl -c /tmp/cookies-contrib.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" -d '{"username":"contributor","password":"Contribute@2026"}'
curl -i -b /tmp/cookies-contrib.txt http://localhost:3000/contribute
# Expected: HTTP 200 (no redirect)

# Log in as admin, confirm PATCH is allowed through middleware (may still 400/404 downstream — that's fine, this only proves the 403 gate isn't blocking)
curl -c /tmp/cookies-admin.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" -d '{"username":"admin","password":"AdminTemple@2026"}'
curl -i -b /tmp/cookies-admin.txt -X PATCH http://localhost:3000/api/temples -d '{}' -H "Content-Type: application/json"
# Expected: NOT a 403 (401/400/404 acceptable at this stage since the route doesn't exist yet)

# Confirm contributor is forbidden from PATCH
curl -i -b /tmp/cookies-contrib.txt -X PATCH http://localhost:3000/api/temples -d '{}' -H "Content-Type: application/json"
# Expected: HTTP 403, {"error":"Admin role required"}
```

Kill the dev server once confirmed.

- [ ] **Step 3: Commit** (only if explicitly requested)

```bash
git add src/middleware.ts
git commit -m "feat: gate /contribute and /api/temples behind session auth"
```

---

### Task 3: Login page UI

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/components/auth/LoginForm.tsx`

**Interfaces:**
- Consumes: `POST /api/login` (Task 1).
- Produces: `/login` route; `LoginForm` client component reusable if needed elsewhere.

- [ ] **Step 1: Write `src/components/auth/LoginForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="ui mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Username</span>
        <input
          className="border border-[var(--line-soft)] bg-[var(--paper)] px-2 py-1.5"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Password</span>
        <input
          type="password"
          className="border border-[var(--line-soft)] bg-[var(--paper)] px-2 py-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="ui bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write `src/app/login/page.tsx`**

```tsx
import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Contributor and admin login for the Temple Directory.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-[420px] px-4 py-10">
      <h1 className="text-2xl">Log in</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Use a contributor or admin account to submit and manage temple entries.
      </p>
      <LoginForm next={next ?? "/contribute"} />
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
cd "/home/nathamuni/ Projects/Temple Dir" && npm run dev
```

In a browser: visit `http://localhost:3000/login`, submit wrong credentials (inline error shown), then submit `contributor` / `Contribute@2026` (redirects to `/contribute`, currently still a 404 until Task 5 — that's expected at this point in the plan; confirm no redirect loop and no console errors instead).

- [ ] **Step 4: Commit** (only if explicitly requested)

```bash
git add src/app/login/page.tsx src/components/auth/LoginForm.tsx
git commit -m "feat: add login page"
```

---

### Task 4: Draft temple creation (`POST /api/temples`)

**Files:**
- Modify: `src/lib/temples.ts` (export `DATA_DIR`, add `invalidateTempleCache`)
- Create: `src/lib/contributionInput.ts`
- Create: `src/app/api/temples/route.ts`

**Interfaces:**
- Consumes: `slugify` (already exported from `src/lib/temples.ts`).
- Produces: `DATA_DIR: string` and `invalidateTempleCache(): void` from `@/lib/temples` (used by Task 6's PATCH handler too); `ContributionInput` type, `validateContribution(input): ValidationError[]`, `buildDraftTemple(slug, input): Temple` from `@/lib/contributionInput` (consumed by Task 5's form and this task's route); `POST /api/temples` returning `{ slug }` on success (201) or `{ errors: ValidationError[] }` on failure (400).

- [ ] **Step 1: Modify `src/lib/temples.ts`**

Change line 5 from:

```ts
const DATA_DIR = path.join(process.cwd(), "data", "temples");
```

to:

```ts
export const DATA_DIR = path.join(process.cwd(), "data", "temples");
```

Add this function after `getAllTemples`:

```ts
export function invalidateTempleCache(): void {
  cache = null;
}
```

- [ ] **Step 2: Write `src/lib/contributionInput.ts`**

```ts
import type { Temple, Reference } from "./types";

export interface ContributionInput {
  name: string;
  subtitle: string;
  deityPresiding: string;
  deityConsort?: string;
  locationCity: string;
  locationDistrict?: string;
  locationState: string;
  locationCountry: string;
  locationAddress?: string;
  locationLat: number;
  locationLng: number;
  templeType: string;
  tradition: string;
  architecturalStyle: string;
  tags: string[];
  establishedPeriod: string;
  establishedYearText: string;
  governingBody: string;
  introParagraph: string;
  heroImageSrc: string;
  heroImageAlt: string;
  heroImageCaption?: string;
  heroImageAuthor: string;
  heroImageLicense: string;
  heroImageSourceUrl: string;
  contactPhone?: string;
  contactEmail?: string;
  contactAddress: string;
  references: { title: string; url?: string; publisher?: string }[];
}

export interface ValidationError {
  field: string;
  message: string;
}

const REQUIRED_STRING_FIELDS: [keyof ContributionInput, string][] = [
  ["name", "Temple name"],
  ["subtitle", "Subtitle"],
  ["deityPresiding", "Presiding deity"],
  ["locationCity", "City"],
  ["locationState", "State"],
  ["locationCountry", "Country"],
  ["templeType", "Temple type"],
  ["tradition", "Tradition"],
  ["architecturalStyle", "Architectural style"],
  ["establishedPeriod", "Established period"],
  ["establishedYearText", "Established year note"],
  ["governingBody", "Governing body"],
  ["introParagraph", "Introduction paragraph"],
  ["heroImageSrc", "Hero image URL"],
  ["heroImageAlt", "Hero image alt text"],
  ["heroImageAuthor", "Hero image author/credit"],
  ["heroImageLicense", "Hero image license"],
  ["heroImageSourceUrl", "Hero image source URL"],
  ["contactAddress", "Contact address"],
];

export function validateContribution(input: Partial<ContributionInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [field, label] of REQUIRED_STRING_FIELDS) {
    const value = input[field];
    if (typeof value !== "string" || value.trim() === "") {
      errors.push({ field, message: `${label} is required` });
    }
  }

  if (typeof input.locationLat !== "number" || Number.isNaN(input.locationLat)) {
    errors.push({ field: "locationLat", message: "Latitude must be a number" });
  }
  if (typeof input.locationLng !== "number" || Number.isNaN(input.locationLng)) {
    errors.push({ field: "locationLng", message: "Longitude must be a number" });
  }

  const refs = input.references ?? [];
  const validRefs = refs.filter((r) => r?.title?.trim());
  if (validRefs.length < 2) {
    errors.push({ field: "references", message: "At least 2 references (with a title) are required" });
  }

  return errors;
}

export function buildDraftTemple(slug: string, input: ContributionInput): Temple {
  const references: Reference[] = input.references
    .filter((r) => r.title?.trim())
    .map((r, i) => ({ id: i + 1, title: r.title, publisher: r.publisher, url: r.url }));

  return {
    slug,
    status: "draft",
    stub: true,
    name: input.name,
    subtitle: input.subtitle,
    deity: { presiding: input.deityPresiding, consort: input.deityConsort || undefined },
    location: {
      city: input.locationCity,
      district: input.locationDistrict || undefined,
      state: input.locationState,
      country: input.locationCountry,
      address: input.locationAddress || undefined,
      coordinates: { lat: input.locationLat, lng: input.locationLng },
    },
    classification: {
      templeType: input.templeType,
      tradition: input.tradition,
      architecturalStyle: input.architecturalStyle,
      tags: input.tags ?? [],
    },
    established: { period: input.establishedPeriod, yearText: input.establishedYearText },
    governingBody: input.governingBody,
    timings: { darshan: [], pujaSchedule: [] },
    heroImage: {
      src: input.heroImageSrc,
      alt: input.heroImageAlt,
      caption: input.heroImageCaption || undefined,
      credit: {
        author: input.heroImageAuthor,
        license: input.heroImageLicense,
        sourceUrl: input.heroImageSourceUrl,
      },
    },
    atAGlance: [],
    sections: {
      introduction: { paragraphs: [input.introParagraph] },
      history: { paragraphs: [] },
      architecture: { paragraphs: [] },
      religiousSignificance: { paragraphs: [] },
      administration: { paragraphs: [] },
      donationsAndServices: { paragraphs: [] },
    },
    worshipSOP: {
      steps: [],
      entryGuidelines: [],
      specialRituals: [],
      restrictions: [],
      spiritualOutcomes: [],
    },
    festivals: [],
    visitingInfo: { bestTime: "", dressCode: "", howToReach: {}, facilities: [] },
    lamp: { enabled: false, lampsToday: 0 },
    gallery: [],
    nearbyTemples: [],
    reviews: [],
    contact: {
      phone: input.contactPhone || undefined,
      email: input.contactEmail || undefined,
      address: input.contactAddress,
    },
    references,
  };
}
```

- [ ] **Step 3: Write `src/app/api/temples/route.ts`**

```ts
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { DATA_DIR, slugify, invalidateTempleCache } from "@/lib/temples";
import { validateContribution, buildDraftTemple, type ContributionInput } from "@/lib/contributionInput";

function uniqueSlug(base: string): string {
  let slug = base;
  let n = 2;
  while (fs.existsSync(path.join(DATA_DIR, `${slug}.json`))) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function POST(req: NextRequest) {
  let body: Partial<ContributionInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validateContribution(body);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const slug = uniqueSlug(slugify(body.name!));
  const temple = buildDraftTemple(slug, body as ContributionInput);
  fs.writeFileSync(path.join(DATA_DIR, `${slug}.json`), JSON.stringify(temple, null, 2) + "\n");
  invalidateTempleCache();

  return NextResponse.json({ slug }, { status: 201 });
}
```

- [ ] **Step 4: Manual verification**

```bash
cd "/home/nathamuni/ Projects/Temple Dir"
npm run dev &
sleep 3

curl -c /tmp/cookies-contrib.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" -d '{"username":"contributor","password":"Contribute@2026"}'

curl -i -b /tmp/cookies-contrib.txt -X POST http://localhost:3000/api/temples \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Verification Temple",
    "subtitle": "Testville, Test State . Presiding Deity: Test",
    "deityPresiding": "Shiva",
    "locationCity": "Testville",
    "locationState": "Test State",
    "locationCountry": "India",
    "locationLat": 10.0,
    "locationLng": 78.0,
    "templeType": "Regional",
    "tradition": "Shaivite",
    "architecturalStyle": "Dravidian",
    "tags": ["test"],
    "establishedPeriod": "20th century",
    "establishedYearText": "Test data",
    "governingBody": "Test Trust",
    "introParagraph": "This is a manual verification entry created while testing Task 4.",
    "heroImageSrc": "/images/temples/test-verification-temple/hero.jpg",
    "heroImageAlt": "Test",
    "heroImageAuthor": "Test Author",
    "heroImageLicense": "CC BY-SA 4.0",
    "heroImageSourceUrl": "https://commons.wikimedia.org/wiki/Test",
    "contactAddress": "Test address",
    "references": [
      {"title": "Test reference one", "url": "https://example.com/1"},
      {"title": "Test reference two", "url": "https://example.com/2"}
    ]
  }'
# Expected: HTTP 201, {"slug":"test-verification-temple"}

cat "data/temples/test-verification-temple.json"
# Expected: valid JSON, status "draft", stub true

curl -s http://localhost:3000/temple/test-verification-temple | grep -o "Test Verification Temple"
# Expected: prints the match, confirming the page renders without a rebuild

# Clean up the test entry so it doesn't linger as fixture data:
rm "data/temples/test-verification-temple.json"
```

Kill the dev server once confirmed.

- [ ] **Step 5: Commit** (only if explicitly requested)

```bash
git add src/lib/temples.ts src/lib/contributionInput.ts src/app/api/temples/route.ts
git commit -m "feat: add POST /api/temples to create draft entries"
```

---

### Task 5: Contribute page + form UI

**Files:**
- Create: `src/app/contribute/page.tsx`
- Create: `src/components/contribute/ContributeForm.tsx`

**Interfaces:**
- Consumes: `POST /api/temples` (Task 4), returning `{ slug }` on success or `{ errors: ValidationError[] }` (each `{ field, message }`) on failure.

- [ ] **Step 1: Write `src/components/contribute/ContributeForm.tsx`**

```tsx
"use client";

import { useState } from "react";

interface ReferenceRow {
  title: string;
  url: string;
  publisher: string;
}

const EMPTY_REFERENCE: ReferenceRow = { title: "", url: "", publisher: "" };

const INITIAL_FORM = {
  name: "",
  subtitle: "",
  deityPresiding: "",
  deityConsort: "",
  locationCity: "",
  locationDistrict: "",
  locationState: "",
  locationCountry: "India",
  locationAddress: "",
  locationLat: "",
  locationLng: "",
  templeType: "",
  tradition: "",
  architecturalStyle: "",
  tags: "",
  establishedPeriod: "",
  establishedYearText: "",
  governingBody: "",
  introParagraph: "",
  heroImageSrc: "",
  heroImageAlt: "",
  heroImageCaption: "",
  heroImageAuthor: "",
  heroImageLicense: "",
  heroImageSourceUrl: "",
  contactPhone: "",
  contactEmail: "",
  contactAddress: "",
};

type FormState = typeof INITIAL_FORM;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </label>
  );
}

const inputCls = "border border-[var(--line-soft)] bg-[var(--paper)] px-2 py-1.5";

export default function ContributeForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [references, setReferences] = useState<ReferenceRow[]>([
    { ...EMPTY_REFERENCE },
    { ...EMPTY_REFERENCE },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ slug: string } | null>(null);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateReference(index: number, key: keyof ReferenceRow, value: string) {
    setReferences((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  function addReference() {
    setReferences((rows) => [...rows, { ...EMPTY_REFERENCE }]);
  }

  function removeReference(index: number) {
    setReferences((rows) => (rows.length <= 2 ? rows : rows.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    const payload = {
      ...form,
      locationLat: Number(form.locationLat),
      locationLng: Number(form.locationLng),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      references: references.filter((r) => r.title.trim()),
    };
    const res = await fetch("/api/temples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      const fieldErrors: Record<string, string> = {};
      for (const err of data.errors ?? []) fieldErrors[err.field] = err.message;
      setErrors(fieldErrors);
      return;
    }
    setResult({ slug: data.slug });
  }

  if (result) {
    return (
      <div className="border border-[var(--line-soft)] bg-[var(--accent-soft)] p-4">
        <p className="font-semibold">Submitted as a draft — pending review.</p>
        <p className="ui mt-2 text-sm">
          <a href={`/temple/${result.slug}`}>View the new entry</a> ·{" "}
          <a href="/status">See it on the status dashboard</a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ui mt-6 flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Basics</legend>
        <Field label="Temple name" error={errors.name}>
          <input className={inputCls} value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </Field>
        <Field label="Subtitle (location · presiding deity)" error={errors.subtitle}>
          <input className={inputCls} value={form.subtitle} onChange={(e) => update("subtitle", e.target.value)} required />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Presiding deity" error={errors.deityPresiding}>
            <input className={inputCls} value={form.deityPresiding} onChange={(e) => update("deityPresiding", e.target.value)} required />
          </Field>
          <Field label="Consort (optional)">
            <input className={inputCls} value={form.deityConsort} onChange={(e) => update("deityConsort", e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Location</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="City" error={errors.locationCity}>
            <input className={inputCls} value={form.locationCity} onChange={(e) => update("locationCity", e.target.value)} required />
          </Field>
          <Field label="District (optional)">
            <input className={inputCls} value={form.locationDistrict} onChange={(e) => update("locationDistrict", e.target.value)} />
          </Field>
          <Field label="State" error={errors.locationState}>
            <input className={inputCls} value={form.locationState} onChange={(e) => update("locationState", e.target.value)} required />
          </Field>
          <Field label="Country" error={errors.locationCountry}>
            <input className={inputCls} value={form.locationCountry} onChange={(e) => update("locationCountry", e.target.value)} required />
          </Field>
          <Field label="Address (optional)">
            <input className={inputCls} value={form.locationAddress} onChange={(e) => update("locationAddress", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" error={errors.locationLat}>
              <input className={inputCls} inputMode="decimal" value={form.locationLat} onChange={(e) => update("locationLat", e.target.value)} required />
            </Field>
            <Field label="Longitude" error={errors.locationLng}>
              <input className={inputCls} inputMode="decimal" value={form.locationLng} onChange={(e) => update("locationLng", e.target.value)} required />
            </Field>
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Classification</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Temple type" error={errors.templeType}>
            <input className={inputCls} value={form.templeType} onChange={(e) => update("templeType", e.target.value)} required />
          </Field>
          <Field label="Tradition" error={errors.tradition}>
            <input className={inputCls} value={form.tradition} onChange={(e) => update("tradition", e.target.value)} required />
          </Field>
          <Field label="Architectural style" error={errors.architecturalStyle}>
            <input className={inputCls} value={form.architecturalStyle} onChange={(e) => update("architecturalStyle", e.target.value)} required />
          </Field>
          <Field label="Tags (comma-separated, optional)">
            <input className={inputCls} value={form.tags} onChange={(e) => update("tags", e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">History &amp; administration</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Established period" error={errors.establishedPeriod}>
            <input className={inputCls} value={form.establishedPeriod} onChange={(e) => update("establishedPeriod", e.target.value)} required />
          </Field>
          <Field label="Established year note" error={errors.establishedYearText}>
            <input className={inputCls} value={form.establishedYearText} onChange={(e) => update("establishedYearText", e.target.value)} required />
          </Field>
        </div>
        <Field label="Governing body" error={errors.governingBody}>
          <input className={inputCls} value={form.governingBody} onChange={(e) => update("governingBody", e.target.value)} required />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Introduction</legend>
        <Field label="Introduction paragraph" error={errors.introParagraph}>
          <textarea
            className={inputCls}
            rows={4}
            value={form.introParagraph}
            onChange={(e) => update("introParagraph", e.target.value)}
            required
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Hero image (Commons-style credit required)</legend>
        <Field label="Image URL" error={errors.heroImageSrc}>
          <input className={inputCls} value={form.heroImageSrc} onChange={(e) => update("heroImageSrc", e.target.value)} required />
        </Field>
        <Field label="Alt text" error={errors.heroImageAlt}>
          <input className={inputCls} value={form.heroImageAlt} onChange={(e) => update("heroImageAlt", e.target.value)} required />
        </Field>
        <Field label="Caption (optional)">
          <input className={inputCls} value={form.heroImageCaption} onChange={(e) => update("heroImageCaption", e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Author / credit" error={errors.heroImageAuthor}>
            <input className={inputCls} value={form.heroImageAuthor} onChange={(e) => update("heroImageAuthor", e.target.value)} required />
          </Field>
          <Field label="License" error={errors.heroImageLicense}>
            <input className={inputCls} value={form.heroImageLicense} onChange={(e) => update("heroImageLicense", e.target.value)} required />
          </Field>
          <Field label="Source URL" error={errors.heroImageSourceUrl}>
            <input className={inputCls} value={form.heroImageSourceUrl} onChange={(e) => update("heroImageSourceUrl", e.target.value)} required />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">Contact</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Phone (optional)">
            <input className={inputCls} value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} />
          </Field>
          <Field label="Email (optional)">
            <input className={inputCls} value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} />
          </Field>
        </div>
        <Field label="Address" error={errors.contactAddress}>
          <input className={inputCls} value={form.contactAddress} onChange={(e) => update("contactAddress", e.target.value)} required />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="wiki-h3">References (minimum 2)</legend>
        {errors.references && <p className="text-xs text-red-700">{errors.references}</p>}
        {references.map((ref, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 border border-[var(--line-soft)] p-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
            <input
              className={inputCls}
              placeholder="Title"
              value={ref.title}
              onChange={(e) => updateReference(i, "title", e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="URL"
              value={ref.url}
              onChange={(e) => updateReference(i, "url", e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Publisher (optional)"
              value={ref.publisher}
              onChange={(e) => updateReference(i, "publisher", e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeReference(i)}
              disabled={references.length <= 2}
              className="ui text-xs text-red-700 underline disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addReference} className="ui self-start text-sm underline">
          + Add another reference
        </button>
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="ui self-start bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit temple as draft"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write `src/app/contribute/page.tsx`**

```tsx
import type { Metadata } from "next";
import ContributeForm from "@/components/contribute/ContributeForm";

export const metadata: Metadata = {
  title: "Contribute a temple",
  description: "Submit a new temple entry to the Temple Directory as a draft for review.",
};

export default function ContributePage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-8">
      <h1 className="text-2xl">Contribute a temple</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Submits a draft entry with the core details below. A reviewer will verify sources
        and complete the remaining sections before publishing.
      </p>
      <ContributeForm />
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
cd "/home/nathamuni/ Projects/Temple Dir" && npm run dev
```

In a browser: log in at `/login` as `contributor` / `Contribute@2026` → redirected to `/contribute`. Submit with required fields blank → inline field errors appear, no request succeeds silently. Fill in all required fields (2 references) and submit → confirmation message with working links to `/temple/<slug>` and `/status`. Delete the test `data/temples/<slug>.json` file afterward to avoid leaving fixture data behind.

- [ ] **Step 4: Commit** (only if explicitly requested)

```bash
git add src/app/contribute/page.tsx src/components/contribute/ContributeForm.tsx
git commit -m "feat: add contribute page and form"
```

---

### Task 6: Admin status update (`PATCH /api/temples`) + status dashboard controls

**Files:**
- Modify: `src/app/api/temples/route.ts` (add `PATCH`)
- Create: `src/components/status/StatusActions.tsx`
- Modify: `src/app/status/page.tsx`

**Interfaces:**
- Consumes: `getSession()` — this task introduces `src/lib/session.ts` early (normally Task 7) because the status page needs it now; Task 7 will reuse the same file for the header. `verifySessionToken`, `SESSION_COOKIE` from `@/lib/auth`; `DATA_DIR`, `invalidateTempleCache` from `@/lib/temples`; `Temple` from `@/lib/types`.
- Produces: `PATCH /api/temples` accepting `{ slug, status }`, returning `{ slug, status }` (200), 400/403/404 on failure.

- [ ] **Step 1: Write `src/lib/session.ts`**

```ts
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE, type SessionPayload } from "./auth";

/** Server Components only (uses next/headers). Route handlers/middleware should call verifySessionToken directly on the request's cookie instead. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
```

- [ ] **Step 2: Add `PATCH` to `src/app/api/temples/route.ts`**

Add these imports at the top (alongside the existing ones):

```ts
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import type { Temple } from "@/lib/types";
```

Append this handler to the end of the file:

```ts
const VALID_STATUSES: Temple["status"][] = ["draft", "pending", "verified", "published"];

export async function PATCH(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  let body: { slug?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { slug, status } = body;
  if (!slug || !status || !VALID_STATUSES.includes(status as Temple["status"])) {
    return NextResponse.json({ error: "slug and a valid status are required" }, { status: 400 });
  }

  const filePath = path.join(DATA_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Temple not found" }, { status: 404 });
  }

  const temple = JSON.parse(fs.readFileSync(filePath, "utf8")) as Temple;
  temple.status = status as Temple["status"];
  fs.writeFileSync(filePath, JSON.stringify(temple, null, 2) + "\n");
  invalidateTempleCache();

  return NextResponse.json({ slug, status: temple.status });
}
```

- [ ] **Step 3: Write `src/components/status/StatusActions.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TempleStatus } from "@/lib/types";

const STATUSES: TempleStatus[] = ["draft", "pending", "verified", "published"];

export default function StatusActions({
  slug,
  currentStatus,
}: {
  slug: string;
  currentStatus: TempleStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(status: TempleStatus) {
    setPending(true);
    setError(null);
    const res = await fetch("/api/temples", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, status }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update status");
      return;
    }
    router.refresh();
  }

  return (
    <div className="ui mt-1 flex items-center gap-1">
      <select
        className="border border-[var(--line-soft)] bg-[var(--paper)] px-1 py-0.5 text-xs"
        value={currentStatus}
        disabled={pending}
        onChange={(e) => updateStatus(e.target.value as TempleStatus)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Modify `src/app/status/page.tsx`**

Add these imports at the top:

```ts
import { getSession } from "@/lib/session";
import StatusActions from "@/components/status/StatusActions";
```

Change the function signature from:

```ts
export default function StatusPage() {
```

to:

```ts
export default async function StatusPage() {
  const session = await getSession();
  const isAdmin = session?.role === "admin";
```

(keep the rest of the existing body below it, just adding the two lines above before `const temples = getAllTemples();`)

In the status table cell that renders the badge, change:

```tsx
<td className="border border-[var(--line-soft)] px-3 py-2">
  <span className={`ui inline-block rounded border px-2 py-0.5 text-xs font-semibold ${style.cls}`}>
    {style.label}
  </span>
</td>
```

to:

```tsx
<td className="border border-[var(--line-soft)] px-3 py-2">
  <span className={`ui inline-block rounded border px-2 py-0.5 text-xs font-semibold ${style.cls}`}>
    {style.label}
  </span>
  {isAdmin && <StatusActions slug={t.slug} currentStatus={t.status} />}
</td>
```

- [ ] **Step 5: Manual verification**

```bash
cd "/home/nathamuni/ Projects/Temple Dir"
npm run dev &
sleep 3

curl -c /tmp/cookies-admin.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" -d '{"username":"admin","password":"AdminTemple@2026"}'

curl -i -b /tmp/cookies-admin.txt -X PATCH http://localhost:3000/api/temples \
  -H "Content-Type: application/json" \
  -d '{"slug":"madurai-meenakshi","status":"verified"}'
# Expected: HTTP 200, {"slug":"madurai-meenakshi","status":"verified"}

cat "data/temples/madurai-meenakshi.json" | grep '"status"'
# Expected: "status": "verified"

# Revert the fixture back to its original status:
curl -i -b /tmp/cookies-admin.txt -X PATCH http://localhost:3000/api/temples \
  -H "Content-Type: application/json" -d '{"slug":"madurai-meenakshi","status":"pending"}'

curl -c /tmp/cookies-contrib.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" -d '{"username":"contributor","password":"Contribute@2026"}'
curl -i -b /tmp/cookies-contrib.txt -X PATCH http://localhost:3000/api/temples \
  -H "Content-Type: application/json" -d '{"slug":"madurai-meenakshi","status":"published"}'
# Expected: HTTP 403 (blocked by middleware before even reaching the route)
```

In a browser: log in as `admin`, visit `/status`, confirm each row shows a status dropdown, changing one updates the badge after `router.refresh()`. Log in as `contributor` instead and confirm `/status` shows no dropdowns.

Kill the dev server once confirmed.

- [ ] **Step 6: Commit** (only if explicitly requested)

```bash
git add src/lib/session.ts src/app/api/temples/route.ts src/components/status/StatusActions.tsx src/app/status/page.tsx
git commit -m "feat: let admins change temple status from the dashboard"
```

---

### Task 7: Header integration (login/logout/contribute links)

**Files:**
- Modify: `src/components/layout/SiteHeader.tsx`
- Create: `src/components/layout/LogoutButton.tsx`

**Interfaces:**
- Consumes: `getSession()` from `@/lib/session` (Task 6).

- [ ] **Step 1: Write `src/components/layout/LogoutButton.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className="ui text-sm underline">
      Log out
    </button>
  );
}
```

- [ ] **Step 2: Modify `src/components/layout/SiteHeader.tsx`**

Replace the whole file with:

```tsx
import Link from "next/link";
import { getSession } from "@/lib/session";
import LogoutButton from "./LogoutButton";

export default async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="border-b border-[var(--line-soft)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-[1100px] items-baseline justify-between gap-4 px-4 py-3">
        <Link href="/" className="!text-[var(--ink)] hover:!no-underline">
          <span className="text-xl">🪔</span>{" "}
          <span className="text-lg font-bold tracking-tight">Temple Directory</span>{" "}
          <span className="ui hidden text-xs text-[var(--ink-soft)] sm:inline">
            — a free encyclopedia of Hindu temples
          </span>
        </Link>
        <nav className="ui flex items-center gap-4 text-sm">
          <Link href="/">Home</Link>
          <Link href="/browse/deity/vishnu">Browse</Link>
          <Link href="/status">Status</Link>
          <Link href="/contribute">Contribute</Link>
          {session ? (
            <>
              <span className="text-xs text-[var(--ink-soft)]">
                {session.username} ({session.role})
              </span>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
cd "/home/nathamuni/ Projects/Temple Dir" && npm run dev
```

In a browser: logged out → header shows "Login". Log in as either account → header shows `username (role)` and "Log out"; clicking "Log out" returns to the logged-out header state. Confirm clicking "Contribute" while logged out redirects to `/login?next=/contribute` and lands back on `/contribute` after logging in.

- [ ] **Step 4: Commit** (only if explicitly requested)

```bash
git add src/components/layout/SiteHeader.tsx src/components/layout/LogoutButton.tsx
git commit -m "feat: show login state and contribute link in site header"
```

---

### Task 8: README documentation + full end-to-end verification

**Files:**
- Modify: `README.md`

**Interfaces:** None (documentation + verification only).

- [ ] **Step 1: Add a "Contributing via the web form" section to `README.md`**

Append (adjust heading level to match the existing document's structure):

```markdown
## Contributing via the web form

Two example accounts are seeded in `.env.local` for local testing (never commit real
credentials — `.env.local` is gitignored):

| Username      | Password           | Role         |
|---------------|---------------------|--------------|
| `contributor` | `Contribute@2026`   | contributor  |
| `admin`       | `AdminTemple@2026`  | admin        |

- Log in at `/login`. A `contributor` can submit a new temple at `/contribute` — it is
  saved as a `status: "draft"`, `stub: true` entry in `data/temples/`.
- An `admin` can additionally change any temple's status (draft → pending → verified →
  published) from the `/status` dashboard.
- This requires a writable local filesystem (works with `npm run dev` / `npm run
  start` on your machine). It will not persist submissions on a read-only or
  serverless deploy target without further work.
- To change the example passwords, regenerate the SHA-256 hashes and update
  `.env.local` — see Task 1 of
  `docs/superpowers/plans/2026-09-11-contribute-login.md` for the exact command.
```

- [ ] **Step 2: Full manual verification checklist**

```bash
cd "/home/nathamuni/ Projects/Temple Dir" && npm run dev
```

Walk through, in a browser, in order:
1. Logged out, visit `/contribute` → redirected to `/login?next=/contribute`.
2. Submit an invalid login → inline "Invalid username or password" error, stays on `/login`.
3. Log in as `contributor` / `Contribute@2026` → redirected to `/contribute`; header shows `contributor (contributor)` and "Log out"; no status dropdowns appear on `/status`.
4. Submit the contribute form with two references and all required fields → confirmation screen; follow the link to `/temple/<slug>` and confirm it renders as a stub page; confirm `/status` lists it as `draft`.
5. Click "Log out" → header reverts to "Login"; `/status` no longer shows the entry's dropdown (still shows the row).
6. Log in as `admin` / `AdminTemple@2026` → `/status` now shows a status dropdown per row; change the new entry's status to `verified` → badge updates after refresh, and `data/temples/<slug>.json` reflects the new status on disk.
7. Delete the test entry's `data/temples/<slug>.json` file (and its confirmation) once done, so no test fixture is left in the data directory.

Report which of these 7 checks passed, and any that didn't, before considering the feature complete.

- [ ] **Step 3: Commit** (only if explicitly requested)

```bash
git add README.md
git commit -m "docs: document contributor login and web submission flow"
```
