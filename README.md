# Temple Directory — Prototype

A Wikipedia-style encyclopedia of Hindu temples: one standard page template, a temple-specific
**Worship SOP** (6 steps), and a mock **Akhand Deepam** (Light a Lamp) donation widget.
Sample entry: **Sri Ranganathaswamy Temple, Srirangam** (fully worked, with CC-licensed images).

Requirement documents live in `Documents/`.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static build; also validates every temple data file
```

## Pages

- `/` — discovery: search, browse chips (deity / state / type / tradition), temple cards
- `/temple/srirangam-ranganathaswamy` — the full standard template (the reference sample)
- `/browse/<facet>/<value>` — e.g. `/browse/deity/vishnu`
- `/status` — onboarding dashboard: totals, pending counts, per-entry completeness, lamp value

## How to add a temple (no code changes needed)

1. Copy `data/TEMPLE_TEMPLATE.jsonc` → `data/temples/<your-slug>.json`
2. Remove all `//` comments (plain JSON), fill in the fields. The template file documents
   every field, which are mandatory, and the editorial rules.
3. Add photos to `public/images/temples/<your-slug>/` and record author / license / source URL
   both in the JSON (`credit`) and in `public/images/ATTRIBUTIONS.md`. Use freely licensed
   images (e.g. Wikimedia Commons) or the temple's own photos with permission.
4. Set `status`: `draft` → `pending` → `verified` → `published`.
   Use `"stub": true` while the entry is still thin — it renders a reduced page.
5. `npm run build` — the validator fails the build naming any missing mandatory field
   (references < 2, SOP steps ≠ 6, etc.).

## Structure

```
data/TEMPLE_TEMPLATE.jsonc     annotated feed-input template (the contributor deliverable)
data/temples/*.json            one file per temple (the feed)
src/lib/types.ts               the schema
src/lib/temples.ts             loader + build-time validation + facet helpers
src/app/temple/[slug]/         the standard temple page template
src/components/temple/         template building blocks (Infobox, SOP, LampWidget, …)
public/images/ATTRIBUTIONS.md  image licensing record
```

## Editorial rules (from the CNESS analysis docs)

- Neutral, encyclopedic third-person tone; no marketing or devotional hype.
- Minimum 2 citations per entry; SOP content must be priest/source-verified before `verified`.
- The SOP documents what **is practised** at the temple — it never prescribes belief.
- Donation UI is subtle and service-like; payments are **not** wired in this prototype.

## Running it

```bash
cp .env.example .env.local     # then set SESSION_SECRET
npm install
npm run dev                    # http://localhost:3000
```

Built-in accounts are in `src/lib/users.ts`. Their passwords come from
`ADMIN_PASSWORD` / `CONTRIBUTOR_PASSWORD`; in development the documented
defaults apply, and in production the app refuses to start without them.

## Deploying

The directory has two halves, and only one of them can be a static site.

**Public half** — homepage, browse, temple pages. Fully static.

```bash
npm run build:static           # → out/ and temple-directory-static.zip
```

Drop the zip on any static host (Netlify, Cloudflare Pages). Login, contribute,
`/status` and the admin screens are excluded from this build: they read a
session cookie and write JSON at request time, which a static host cannot do.

**Full site** — needs a Node server *and* a writable disk, because a
contributor submitting a draft or an admin approving a request writes a JSON
file. `render.yaml` describes exactly that:

1. Push this repo to GitHub.
2. Render → New → Blueprint → select the repo. It reads `render.yaml`.
3. Set `ADMIN_PASSWORD` and `CONTRIBUTOR_PASSWORD` in the dashboard.
   `SESSION_SECRET` is generated automatically.

The disk mounts at `/var/data` and `DATA_DIR` points there, so live data sits
outside the deployed code and survives every redeploy. On first boot the app
seeds that disk from the committed `data/` directory; after that the disk is
the source of truth and the committed copy is only a seed.

A free instance has **no persistent disk** — writes would vanish on restart.
The blueprint therefore specifies a paid instance.

### Known limits of the current auth

Not production-grade, and deliberately so until real auth lands:

- Contributor passwords are stored **in plaintext** in
  `contributor-requests.json`. Fine for a closed pilot, not for public signup.
- There is no password reset, no email verification, no rate limiting on login.
- `/status` is public by design — it exposes draft and rejected entries,
  including rejection reasons.

Google Sign-In / Phone OTP is the intended replacement.
