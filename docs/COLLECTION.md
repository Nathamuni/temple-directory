# Temple collection pipeline (location by location)

Internal working tables (migration `004_collection.sql`). The public site reads only `temples`; a candidate is promoted
after review. Start: Tamil Nadu, Cuddalore district as the pilot.

## Inclusion rules
- Include major temples, village temples, small independent shrines and locally maintained temples.
- A temple complex is one main record; shrines inside it link through `parent_candidate_id`. Independently accessible temples stay separate.
- Closed, relocated or ruined temples are kept with `physical_status`, never deleted.
- Unknown information is `NULL`. Never invent coordinates, contacts, timings or history.
- A village centre is never stored as an exact temple coordinate (`coordinate_basis = 'village_centre'` is for internal search only).
- Merge duplicates only on external ids, aliases + proximity + deity together; never on name alone or distance alone.
- Ten pages repeating one text are one piece of evidence (`independent_group`).

## Candidate states
`candidate` → `source_supported` → `corroborated` (independent sources) → `management_confirmed`; or `conflicted` / `rejected`.

## Coverage numbers (kept separate)
1. Geography coverage: official locations imported and reconciled.
2. Discovery coverage: completed coverage units / planned units. This measures research work done, **not** the share of real temples found.
3. Record quality: discovered temples that meet publication rules.

A district is "Discovery pass complete" only when its worklist is reconciled, all required tasks succeeded or have an approved exception,
pagination was exhausted, unresolved location/duplicate cases are reviewed or reported, and no-findings places got a second pass.

## Source access
Allowed: LGD / data.gov.in bulk files, OSM extracts (ODbL attribution), Wikidata, Wikipedia, district `.nic.in` pages (robots.txt,
rate limit, cache), official temple websites. Not used: Google Maps content; the public Nominatim endpoint for enumeration;
the HR&CE search page, which has a CAPTCHA (no bypass; use its public profile pages or request an export).

## Running the pilot (Cuddalore)
```
tools/.venv/bin/python -I tools/collect/osm_places.py Cuddalore      # provisional places from OSM
tools/.venv/bin/python -I tools/collect/wiki_search.py Cuddalore     # pass B (cached, bounded retries)
tools/.venv/bin/python -I tools/collect/build_pilot.py Cuddalore --reset   # pass A + B into the tables (resets them)
tools/.venv/bin/python -I tools/collect/district_site.py Cuddalore   # district-government temple pages as evidence
tools/.venv/bin/python -I tools/collect/report.py Cuddalore          # docs/coverage/cuddalore-pilot.md
```
Reconciling with official LGD files later: places keep their `geo_entities.id`; fill `lgd_code` and set `basis='official'` by matching name/aliases, then repoint `parent_id`.

## Statewide name collection (2026-10-22)
Order: `collect/osm_extra.py` (OSM temples the main extract skips) -> `collect/wikidata_names.py` (any-language names, state/district from the P131 chain) -> `collect/hrce_profiles.py` (Tamil Nadu HR&CE public profile pages, ids 1-49500, headers only, polite pace) -> `collect/merge_sources.py` (idempotent: re-running drops the earlier batch). Records with no coordinate carry `"located": false` and are never given a village-centre point.
GeoNames temple/shrine rows (`collect/geonames_temples.py`, CC BY 4.0) are merged when the name reads as a Hindu temple and no other faith's word appears (639 added of 1,680). Tried and left out: Commons category tree (too many photo sub-categories and non-temples). Kerala, Karnataka, Telangana endowment sites do not answer from the build machine; Andhra Pradesh district sites publish scanned PDFs only (would need OCR).
Overture Maps places (`collect/overture_temples.py`, release 2026-10-21.0; CDLA-Permissive-2.0, attribution "Overture Maps Foundation") add 85,614 located temples. Candidates (128,912, India address): category `hindu_place_of_worship`, plus places filed as religious_organization, historic_site, monument, landmark or uncategorised whose name has a temple word (`overture:category` tag keeps the original). Dropped: 23,724 already held (within 60 m, or the same name within 500 m), 16,376 whose name does not read as a Hindu temple, 2,477 of another faith or not a temple (halls, schools), 705 with only a generic name ("Temple", "Mandir"), 15 outside India's states. The records come from Meta's place data, are not checked against a temple authority, and many have generic names ("Shiv Mandir"), so the detail page says so. Overture ids are UUIDs; the app id is `ov-<first 12 hex digits as a number>` (no collisions) and the UUID is kept as `ref:overture`. A second name filter keeps monastery/shrine words (math, mutt, sthan, kalibari, kavu, namghar, iskcon ...) that the first one dropped. 242 mapped OSM temples that had only a `name:*` tag (name:ta, name:kn ...) are now named from it (`name_source` tag records which). Foursquare's open places now sit behind a Hugging Face login and were not used.

Known limit: Tamil Nadu HR&CE vs Wikidata overlap is about 0.3% in a 300-record sample, but spelling variants of the same temple can still appear twice.
