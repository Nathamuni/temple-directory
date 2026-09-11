# Contributor login + temple submission — design

Date: 2026-09-11
Status: approved by user, ready for implementation plan

## Goal

Let a logged-in contributor submit a new temple entry into the directory through a web
form, and let an admin advance an entry's editorial status, without a database — the
directory remains file-based JSON under `data/temples/`.

## Background

Temple Directory (CNESS Inc.) is a Wikipedia-style Next.js 15 + TS + Tailwind v4
prototype. Data is one JSON file per temple in `data/temples/`, schema in
`src/lib/types.ts`, validated at build time in `src/lib/temples.ts` (min 2 references,
exactly 6 SOP steps unless `stub: true`). Contributor-facing template at
`data/TEMPLE_TEMPLATE.jsonc`. Entries already carry a `status` field
(`draft → pending → verified → published`) and a `/status` dashboard shows totals.

The project's requirements docs (`Documents/*.docx`) call for "every volunteer, admin,
and temple contact fills the same structured data entry template" with editorial
approval, and describe an eventual Google Sign-In + Phone OTP auth (Phase 3). This
prototype implements a lightweight stand-in for that auth so the contribution flow can
be tested now; swapping in real OAuth later only touches `src/lib/auth.ts`.

## Decisions (from brainstorming with user)

- **Auth**: two hardcoded example accounts, roles `contributor` and `admin`. No user
  database.
- **Session mechanism**: hand-rolled signed cookie (HMAC-SHA256), no new dependency.
  Chosen over next-auth (too much setup for two hardcoded accounts) and iron-session
  (an extra dependency for something ~30 lines of code covers).
- **Form scope**: core fields only → creates a `status: "draft"`, `stub: true` entry,
  matching the existing stub-rendering behavior. Full-schema fields (worship SOP,
  festivals, gallery, reviews, other wiki sections) are left for manual JSON editing
  later.
- **Images**: URL + credit fields (author/license/sourceUrl), matching the existing
  Wikimedia Commons attribution model — no raw file upload.
- **Storage**: API route writes directly to `data/temples/<slug>.json` on the server's
  local filesystem (same format/location as existing temples). This requires a
  writable filesystem — works for local `npm run dev`; will not persist on a
  read-only/serverless deploy target without further work (out of scope here).
- **Roles**: `contributor` can submit drafts only. `admin` can also change status on
  `/status`.

## Architecture

New pieces layered on the existing app; nothing existing changes shape.

- `src/lib/auth.ts` — hardcoded example accounts (bcrypt-hashed passwords), cookie
  sign/verify helpers, `getSession()` helper for server components/routes.
- `src/middleware.ts` — guards `/contribute` and the status-mutation API route;
  redirects unauthenticated requests to `/login`.
- `src/app/login/page.tsx` — username/password form, posts to the login API route.
- `src/app/api/login/route.ts` — validates credentials, sets the signed session cookie.
- `src/app/api/logout/route.ts` — clears the cookie.
- `src/app/contribute/page.tsx` — the "add a temple" form (session-gated).
- `src/app/api/temples/route.ts` — `POST` validates submitted fields, builds a `Temple`
  object (`status: "draft"`, `stub: true`), slugifies the name (suffixing on
  collision), writes `data/temples/<slug>.json`. `PATCH` (admin-only) updates
  `status` on an existing temple JSON file.
- `src/app/status/page.tsx` (existing, extended) — an `admin` session sees inline
  controls to advance a temple's status, calling the `PATCH` above.

## Data flow

1. Visitor hits `/contribute` → middleware checks cookie → no session → redirect to
   `/login`.
2. Logs in with an example account → cookie set → redirected back to `/contribute`.
3. Fills core fields → submits → API route validates, generates a unique slug, writes
   the JSON file with `status: "draft"`, `stub: true`.
4. Contributor sees a confirmation ("submitted as draft, pending review") and a link to
   the new (stub) temple page — the existing `temples.ts` loader already renders stub
   entries, so it shows up immediately.
5. An `admin` session on `/status` can promote it through the workflow states already
   defined in `TempleStatus`.

## Auth details

Two example accounts, seeded as bcrypt hashes read from `.env.local` (gitignored);
plaintext example credentials are given to the user out of band, not committed.

- `contributor` / role `contributor` — can submit drafts only.
- `admin` / role `admin` — can submit drafts **and** change status on `/status`.

Session cookie: `temple_session`, httpOnly, signed (not encrypted — no secret payload
beyond username/role), 8-hour expiry, `SameSite=Lax`.

## Contribute form (core-fields scope)

Maps to a subset of `Temple`, matching `TEMPLE_TEMPLATE.jsonc`'s contributor-facing
fields:

- Name, subtitle, deity (presiding/consort/others)
- Location (city, district, state, country, address, lat/lng)
- Classification (templeType, tradition, architecturalStyle, tags)
- Established (period, yearText), governing body
- One introduction paragraph (`sections.introduction`)
- Hero image: URL, alt text, caption, author, license, source URL
- At least 2 references (title + url) — enforced client- and server-side, matching the
  existing build-time validator's minimum
- Contact (phone/email/address)

Everything else (worshipSOP steps, festivals, gallery, reviews, other sections) is
omitted from the form; `stub: true` renders the existing reduced page, same as the
three current stub temples.

## Validation & error handling

- Required-field and shape validation server-side in the API route, reusing/extending
  logic similar to the existing build-time validator in `temples.ts`. Rejects with 400
  and field-level errors rendered inline in the form.
- Slug collisions: derive slug from name, append `-2`/`-3` if taken rather than
  overwriting.
- Auth failures: generic "invalid credentials" message, no user enumeration.
- Filesystem write failures: caught, surfaced as a form-level error.

## Testing

No test harness exists in this repo; per the project's operating rules, none is added
for this feature. Verification is manual:

- Log in as both `contributor` and `admin`.
- Submit a temple as `contributor`; confirm the JSON file is created correctly and the
  new `/temple/<slug>` page and `/status` dashboard reflect it.
- Confirm a logged-out visit to `/contribute` redirects to `/login`.
- Confirm an invalid login is rejected with a generic error.
- As `admin`, advance the new entry's status on `/status` and confirm the JSON file's
  `status` field updates.

## Out of scope

- Real OAuth/OTP login (Phase 3 in the requirements docs).
- Full-schema contribution form (worship SOP, festivals, gallery, reviews).
- Persistence on read-only/serverless hosting.
- Raw image file uploads.
- A user database / self-service signup.
