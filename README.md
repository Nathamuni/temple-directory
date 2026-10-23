# Global Temple Directory

> The earlier Next.js prototype (63 hand-curated temples, role accounts) is preserved on the [`old-version`](https://github.com/Nathamuni/temple-directory/tree/old-version) branch.

Find Hindu temples by name, deity, place or what is near them; rate and comment on the facilities inside each temple (no sign-in); and let volunteers add and correct data with a source and a date. 101,224 temples across India today: 45,701 with a map location (43,982 from OpenStreetMap, 1,719 from Wikidata) and 55,523 name-only (a name, state and usually a district, but no known location: 43,355 from the Tamil Nadu HR&CE Department's public temple pages, 12,168 from Wikidata), structured so more countries can be added.

## Run it
```bash
docker compose up --build        # http://localhost:8080 (starts Postgres + app, loads the data on first start)
```
Without Docker: `npm install`, start any Postgres, set `DATABASE_URL` (see `.env.example`), then `npm run migrate && npm run import && npm start`. Tests: `BASE=http://localhost:8080 npm test` against a running dev server (`DEV_LINKS=1`).
**Deploy and move to Render or anywhere:** [docs/DEPLOY.md](docs/DEPLOY.md). **API:** [docs/API.md](docs/API.md). **Data model:** [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## What it does
- **Search by any aspect:** `vishnu chennai`, `perumal madras`, `toilets kerala`, a PIN code. Old names and deity aliases work (`data/search-synonyms.json`); suggestions appear under the box.
- **Facilities checklist on every temple** (`data/facilities-checklist.json`): dustbins, drinking water, toilets, footwear stand, lighting and more. Each item gets 1-5 stars, comments and upvotes (upvote only). **No login needed.** Nothing is pre-filled.
- **Volunteers** sign in with a name and email (no password; email verification is switched off for now, so the email is stored but not checked) to add profile values, report needs and add notes, each with a source and a date. Everything is labelled **"Volunteer · data accuracy"** and logged.
- **Admin approval with a bypass switch:** the Admin page has a *Require approval* switch. Off (default): volunteer changes go live at once. On: they wait in a queue for approve / reject. Admin can revert any change from the change log.
- **Home page:** browse by country, state and deity; top-rated and most-upvoted temples (real ratings only); facilities summary.
- **Open data:** `/api/export/temples.ndjson | .csv | .geojson` and `community.json`; no export contains an email.

## Layout
```
index.html, *.js, *.css      front-end (plain HTML/JS; scripts wrap each other, load order is in index.html)
  api.js                     the only data layer: server adapter + browser-only fallback
  facilities.js search.js home-sections.js needs.js fields.js volunteer.js auto-load.js visuals.js ...
server/                      Fastify API (routes/, auth.js, settings.js, scripts/, test/)
db/migrations/               plain SQL schema
data/                        india-temples.json, field-schema.json, facilities-checklist.json, search-synonyms.json, dataset-info.json
tools/                       data pipeline (Python/Node): OSM extract, Wikidata, enrichment, nearby photos
Dockerfile docker-compose.yml render.yaml .env.example docs/
```

## Data and honesty
- Temples, coordinates and tags come from OpenStreetMap (ODbL). Each enriched value records its basis; **deity is mostly inferred from the temple name and is shown as "inferred"**. Only 46 temples have a sourced deity.
- Photos are licensed Wikimedia Commons images (credit and licence shown): from Wikidata links, or geotagged near the temple (4,447 temples, labelled "Nearby photo" with the distance). Most temples have no photo on Commons.
- Nearby facilities (toilets, water, parking, hospital, rail, bus, airport) are **straight-line distances to features mapped in OpenStreetMap**; where nothing is mapped the map may simply be incomplete.
- Opening hours, fees, phone numbers and rituals are not filled except where OSM has them, because no reliable open source exists. 25 of 52 profile fields have no automatic source and depend on volunteers.
- Known gap: Arunachal Pradesh (its boundary is not in the extract used).

## Rebuilding the data (maintainers)
`tools/` holds the pipeline: `extract_india_temples.py` (Geofabrik extract → temples with state and district), `fetch_wikidata_temples.py`, `fetch_wikipedia_coords.py`, `add_wikidata_temples.py` (Wikidata temples missing from OpenStreetMap become their own records; run again after any re-extract), `fetch_wikidata_extra.py`, `fetch_nearby_photos.py`, `compute_nearby.py`, `enrich_temples.py` (merge, writes `india-temples.json` and `data/dataset-info.json`), then `npm run import`. Python steps use a local venv (`tools/.venv`, packages `osmium shapely`). `tools/fetch-india-temples.mjs` is an older, slow Overpass route.

## Static / demo mode
If no server answers `/api/health`, the site still works as a browser-only demo (nothing shared). `temple-directory-single-file.html` is an old prototype copy and does not include any of the current features.
