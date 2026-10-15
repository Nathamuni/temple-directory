# Data model

Plain Postgres (12+), no extensions, no ORM. The whole schema is `db/migrations/*.sql` (applied in order by `npm run migrate`, idempotent). Re-create from scratch: `npm run migrate && npm run import`.

## Temples
`temples` has one row per OpenStreetMap object (`id = 'osm-<node|way|relation>-<osm id>'`) or per Wikidata temple that is not on OpenStreetMap (`id = 'wd-Q<number>'`, `osm_type = 'wikidata'`, `osm_id` = the QID number; `tags` holds only name, wikidata and wikipedia): `country, state, district, name, native_name, lat, lon, deity (+ deity_basis), tradition, completeness`, and three JSON columns: `tags` (raw OSM tags), `enrich` (Wikidata, Wikipedia summary, nearby photo, each with its basis) and `computed` (nearest railway / bus / airport, hospital, toilets, parking and drinking water within 300 m; straight-line, from mapped features only). Source file: `data/india-temples.json` (rebuilt by `tools/*.py`, see README). Every enriched value records **how it was obtained** (`wikidata_link`, `spatial_name`, `osm_tag`, `INFERRED_from_name`...). Inferred values are always labelled as inferred in the UI.

## People
- **Anyone** (no account): a `devices` row identified by an httpOnly cookie. Used only to allow one rating per item and one upvote per comment per browser. Optional `contacts(email, consent_at)` are stored apart and **never returned by any endpoint or export**.
- **Volunteers** (`users`, role `volunteer`) sign in with a name and email that are **stored but not verified** (email verification is switched off for now; `magic_links` is unused until it is re-enabled). Sessions store only a SHA-256 hash of the cookie token. **Admin** is the dummy admin (role `admin`); an email never grants it.

## Community (no sign-in)
`ratings(temple_id, item_key, device_id, stars 1-5)` primary key makes one-per-browser structural. `comments(text 5-500, hidden)`, `upvotes(comment_id, device_id)` (upvote only). Checklist items live in `data/facilities-checklist.json` (stable keys, never renamed).

## Volunteer data (sign-in)
`field_values` (value + `source_type` + `source_ref` + `checked_on`; one `current` row per temple and field), `needs_reports`, `notes`. Each has `approval`: `approved` | `pending` | `rejected` (+ `reject_reason`).

## Approval switch
`settings.require_approval` (default `true` = approval on; an admin can switch it off for bypass). Off: volunteer changes are `approved` immediately. On: they are `pending`, visible only to their author and admins, until an admin approves (publishes) or rejects them with a reason. Admin edits are always published directly. Ratings, comments and upvotes never need approval.

## Audit log
`edits` records every volunteer write and admin action (`create`, `update`, `submit`, `approve`, `reject`, `hide`, `restore`, `revert`) with `before` / `after` JSON and `revert_of`. An admin can revert any change that went live.

## Exports (your data is never locked in)
`/api/export/temples.ndjson | .csv | .geojson`, `/api/export/community.json` (approved data only), `npm run export` (everything, including pending, no emails) and `pg_dump "$DATABASE_URL"` for a full backup.
