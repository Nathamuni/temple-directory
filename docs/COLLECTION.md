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
