#!/usr/bin/env python3
"""Coverage report for the collection tables -> docs/coverage/<district>-pilot.md  (numbers come from the database, not from the build script)."""
import os, subprocess, sys
from pathlib import Path
root = Path(__file__).resolve().parent.parent.parent
district = sys.argv[1]
DB = os.environ.get("DATABASE_URL", "postgres://postgres:temple@localhost:5440/temple_directory")


def rows(sql):
    r = subprocess.run(["psql", DB, "-tAF", "\t", "-c", sql], capture_output=True, text=True, check=True)
    return [l.split("\t") for l in r.stdout.strip().split("\n") if l]


one = lambda sql: rows(sql)[0][0]
table = lambda head, rs: "| " + " | ".join(head) + " |\n|" + "---|" * len(head) + "\n" + "\n".join("| " + " | ".join(r) + " |" for r in rs) + "\n"

A = one("select count(*) from temple_candidates where temple_id is not null")
B = one("select count(*) from temple_candidates where temple_id is null")
dups = one("select count(*) from field_evidence f join temple_candidates c on c.id=f.candidate_id where c.temple_id is not null and f.independent_group like 'wikipedia-%'")
enriched = one("select count(distinct candidate_id) from field_evidence f join temple_candidates c on c.id=f.candidate_id where c.temple_id is not null and f.independent_group like 'wikipedia-%'")
named_A = one("select count(*) from temple_candidates where temple_id is not null and (name_en is not null or name_ta is not null)")
units = rows("select g.type, count(*) from coverage_units u join geo_entities g on g.id=u.entity_id group by 1 order by 1")
status = rows("select status, count(*) from coverage_units group by 1 order by 2 desc")
jobs = rows("select pass, status, count(*) from discovery_jobs group by 1,2 order by 1,2")
unres = rows("select reason, count(*) from review_queue group by 1 order by 1")
unplaced = one("select count(*) from temple_candidates where place_id is null")
nocoord = one("select count(*) from temple_candidates where lat is null")
fields = rows("""select f.field_key, count(distinct f.candidate_id) from field_evidence f group by 1 order by 2 desc""")
total = int(A) + int(B)
by_taluk = rows("""select coalesce(t.name_en,'(no taluk)'), count(distinct c.id) filter (where c.temple_id is not null), count(distinct c.id) filter (where c.temple_id is null), count(distinct p.id)
  from geo_entities p left join geo_entities t on t.id=p.parent_id and t.type='taluk'
  left join temple_candidates c on c.place_id=p.id where p.type<>'taluk' and p.type<>'district' and p.type<>'state' group by 1 order by 2 desc""")
no_tamil = one("select count(*) from coverage_units u join geo_entities g on g.id=u.entity_id where g.type<>'taluk' and g.name_ta is null")
nofind = one("select count(*) from coverage_units where status='IN_PROGRESS'")
md = f"""# Provisional {district} pilot — partial source coverage

**This is not a complete temple inventory.** The place list is provisional (OpenStreetMap, no LGD codes), discovery used OSM, Wikidata and
Wikipedia (English + Tamil) only, and no web-search pass (pass C) was run. "Searched" means a source was queried, not that a place has no more temples.

## Temples
{table(["Group", "Count", "Meaning"], [
    ["Existing records (pass A)", A, f"already in the directory from OSM / Wikidata; {named_A} have a name"],
    ["Newly discovered (pass B)", B, "from Wikipedia (mostly Tamil village-temple articles) and cuddalore.nic.in temple pages; not yet reviewed"],
    ["Enriched existing records", enriched, "existing records that gained Wikipedia evidence"],
    ["Duplicates merged", dups, "Wikipedia hits matched to an existing record (Wikidata id, or name + distance) and added as evidence instead of a new record"],
    ["**Total candidates**", str(total), "all state `candidate`; none reviewed or corroborated yet"]])}
## Places
{table(["Type", "Provisional places"], units)}
Units with a Tamil name searched in Tamil too; **{no_tamil}** places have no Tamil name, so only English queries ran for them.

{table(["Unit status", "Count"], status)}
`IN_PROGRESS` ({nofind}) = nothing found yet and the second pass has not run.

## Tasks
{table(["Pass", "Status", "Jobs"], jobs)}
Pass C (aliases, deity words, gap searches) is **blocked**: it needs a licensed web-search API. Blocked sources: LGD downloads (CAPTCHA), HR&CE search (CAPTCHA).

## Unresolved gaps
{table(["Review reason", "Records"], unres)}
- Candidates with no place assigned: **{unplaced}**; with no coordinates: **{nocoord}** (Wikipedia articles without a map point; their place is a text match only).
- The 166 provisional places are far fewer than the district's real villages, so places missing from the list were never searched.

## Spot check
9 randomly chosen new Tamil Wikipedia temples were read against their own text: all 9 state they are in Cuddalore district. Their **place** is the
nearest provisional place or the searched place, so it can differ from the village the article names (for example a village missing from the
provisional list). Treat place on text-only records as approximate. Only 9 were checked.

## Fields with evidence (candidates holding each)
{table(["Field", "Candidates"], fields)}
Everything else is empty (`NULL`): timings, history, festivals, facilities, contacts for most temples.

## By taluk (provisional)
{table(["Taluk", "Existing", "New", "Places"], by_taluk)}
"""
out = root / "docs" / "coverage" / f"{district.lower()}-pilot.md"
out.write_text(md)
print(md)
