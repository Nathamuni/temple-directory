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
