#!/usr/bin/env python3
"""Build the collection tables for one district from: provisional OSM places, existing OSM/Wikidata temples (pass A), Wikipedia hits (pass B).
Writes SQL and loads it with psql. Idempotent: it resets the collection tables first (pilot only; `--reset` is required).

  tools/.venv/bin/python -I tools/collect/build_pilot.py Cuddalore --reset
Pass C (aliases / deity words / gaps) needs a licensed web-search API and is NOT run; units are marked accordingly.
"""
import json, math, os, pickle, re, subprocess, sys
from pathlib import Path
from shapely import wkb
from shapely.geometry import Point

root = Path(__file__).resolve().parent.parent.parent
district = sys.argv[1]
if "--reset" not in sys.argv:
    sys.exit("refusing to run without --reset (this rebuilds the collection tables)")
DB = os.environ.get("DATABASE_URL", "postgres://postgres:temple@localhost:5440/temple_directory")
PIPE = "pilot-1"
places = json.loads((root / "tools/cache" / f"{district.lower()}-places.json").read_text())
wiki = json.loads((root / "tools/cache" / f"{district.lower()}-wiki-hits.json").read_text())
meta = wiki["_meta"]
bd = pickle.load(open(root / "tools/cache/boundaries.pkl", "rb"))
n5, p5 = bd["5"]
dpoly = wkb.loads(p5[[k for k, n in enumerate(n5) if n.startswith(district)][0]])
temples = [e for e in json.loads((root / "india-temples.json").read_text())["elements"]
           if e.get("state") == "Tamil Nadu" and district.lower() in (e.get("district") or "").lower()]
q = lambda v: "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"
GENERIC = {"temple", "kovil", "koil", "sri", "shri", "sree", "swamy", "swami", "amman", "mandir", "mandiram", "unnamed", "hindu", "devi"}
norm = lambda s: re.sub(r"[^a-z஀-௿ ]", "", (s or "").lower())
toks = lambda s: {w for w in norm(s).split() if len(w) >= 4 and w not in GENERIC}


def hav(a, b, c, d):
    p = math.pi / 180
    x = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 12742000 * math.asin(math.sqrt(x))


sql = ["BEGIN;", "TRUNCATE geo_entities, geo_links, place_aliases, coverage_units, discovery_jobs, temple_candidates, candidate_external_ids, "
       "field_evidence, review_queue, sources, documents RESTART IDENTITY CASCADE;"]
SRC = {}


def source(url, publisher, licence):
    if url not in SRC:
        SRC[url] = len(SRC) + 1
        sql.append(f"INSERT INTO sources(id,url,publisher,licence,retrieved_at) VALUES({SRC[url]},{q(url)},{q(publisher)},{q(licence)},now());")
    return SRC[url]


osm_geo = source("https://download.geofabrik.de/asia/india-latest.osm.pbf", "OpenStreetMap contributors (Geofabrik extract)", "ODbL 1.0")
# ---- geography (provisional) ----
gid = {"state": 1, "district": 2}
sql.append(f"INSERT INTO geo_entities(id,type,name_en,source_id,basis) VALUES(1,'state','Tamil Nadu',{osm_geo},'provisional_osm'),(2,'district',{q(places['district'])},{osm_geo},'provisional_osm');")
for k, t in enumerate(places["taluks"]):
    gid["taluk:" + t] = 3 + k
    sql.append(f"INSERT INTO geo_entities(id,type,name_en,parent_id,source_id,basis,place_kind) VALUES({3 + k},'taluk',{q(t)},2,{osm_geo},'provisional_osm','admin_level=6');")
TYPE = {"city": "urban_body", "town": "urban_body", "village": "revenue_village", "hamlet": "hamlet", "suburb": "ward", "neighbourhood": "ward", "quarter": "ward", "locality": "hamlet", "isolated_dwelling": "hamlet"}
base = 100
pl = []
for k, p in enumerate(places["places"]):
    i = base + k; gid["place:" + str(p["osm_id"])] = i; p["gid"] = i; pl.append(p)
    parent = gid.get("taluk:" + (p["taluk"] or ""), 2)
    sql.append(f"INSERT INTO geo_entities(id,type,name_en,name_ta,parent_id,source_id,basis,osm_id,place_kind,lat,lon) VALUES({i},{q(TYPE[p['place']])},{q(p['name'])},{q(p['name_ta'])},{parent},{osm_geo},'provisional_osm',{q('node/' + str(p['osm_id']))},{q('place=' + p['place'])},{p['lat']},{p['lon']});")
    for a in {x for x in p["alt"] if x}:
        sql.append(f"INSERT INTO place_aliases(entity_id,alias,lang,kind) VALUES({i},{q(a)},'en','spelling') ON CONFLICT DO NOTHING;")
sql.append(f"SELECT setval('geo_entities_id_seq', {base + len(pl) + 10});")
by_name = {}
for p in pl:
    for n in {norm(p["name"]), norm(p["name_raw"])} | {norm(a) for a in p["alt"]}:
        if n: by_name.setdefault(n, p)


def nearest_place(lat, lon, within=3000):
    best = min(pl, key=lambda p: hav(lat, lon, p["lat"], p["lon"]))
    return best if hav(lat, lon, best["lat"], best["lon"]) <= within else None


# ---- pass A: existing candidates ----
cands = []  # dicts
ev = []


def evidence(cid, key, val, src, passage, grp):
    if val:
        ev.append(f"INSERT INTO field_evidence(candidate_id,field_key,value,source_id,passage,independent_group) VALUES({cid},{q(key)},{q(val)},{src},{q(passage)},{q(grp)});")


for e in temples:
    t = e["tags"]; en = e.get("enrich") or {}
    lat, lon = (e["lat"], e["lon"]) if "lat" in e else (e["center"]["lat"], e["center"]["lon"])
    wd = e["type"] == "wikidata"
    tid = f"wd-Q{e['id']}" if wd else f"osm-{e['type']}-{e['id']}"
    ne = en.get("name_en")
    name = t.get("name:en") or t.get("name") or (ne.get("value") if isinstance(ne, dict) else ne)
    place = None
    for k in ("addr:village", "addr:suburb", "addr:town", "addr:city", "addr:hamlet"):
        if t.get(k) and norm(t[k]) in by_name: place = by_name[norm(t[k])]; break
    place = place or nearest_place(lat, lon)
    cid = len(cands) + 1
    c = {"id": cid, "tid": tid, "name": name, "name_ta": t.get("name:ta"), "lat": lat, "lon": lon, "place": place,
         "qid": (en.get("wikidata") or {}).get("qid") or (f"Q{e['id']}" if wd else None), "basis": "wikidata" if wd else "osm", "toks": toks(name)}
    cands.append(c)
    dv = en.get("deity") or {}
    deity = ", ".join(dv.get("values", [])) if dv.get("basis") != "INFERRED_from_name" and dv.get("values") else None
    url = f"https://www.wikidata.org/wiki/Q{e['id']}" if wd else f"https://www.openstreetmap.org/{e['type']}/{e['id']}"
    sid = source(url, "Wikidata" if wd else "OpenStreetMap contributors", "CC0" if wd else "ODbL 1.0")
    grp = "wikidata" if wd else "osm"
    c["sql"] = (f"INSERT INTO temple_candidates(id,name_en,name_ta,place_id,lat,lon,coordinate_basis,deity,status,temple_id) VALUES({cid},{q(name)},{q(c['name_ta'])},{place['gid'] if place else 'NULL'},{lat},{lon},{q(c['basis'])},{q(deity)},'candidate',{q(tid)});")
    sql.append(c["sql"])
    sql.append(f"INSERT INTO candidate_external_ids(candidate_id,scheme,value) VALUES({cid},{q('wikidata' if wd else 'osm')},{q('Q' + str(e['id']) if wd else e['type'] + '/' + str(e['id']))});")
    if c["qid"] and not wd:
        sql.append(f"INSERT INTO candidate_external_ids(candidate_id,scheme,value) VALUES({cid},'wikidata',{q(c['qid'])}) ON CONFLICT DO NOTHING;")
    for key, tag in (("temple_name", "name"), ("phone", "phone"), ("official_website", "website"), ("darshan_timings", "opening_hours"), ("managing_body", "operator"), ("built_period", "start_date")):
        evidence(cid, key, t.get(tag) or (t.get("contact:" + tag)), sid, f"{tag} tag on the source record", grp)
    if deity: evidence(cid, "deity", deity, sid, f"deity from {dv.get('source')} ({dv.get('basis')})", grp)
    if not place:
        sql.append(f"INSERT INTO review_queue(candidate_id,reason,detail) VALUES({cid},'location_unresolved','no addr tag match and no mapped place within 3 km');")
    if not name:
        sql.append(f"INSERT INTO review_queue(candidate_id,reason,detail) VALUES({cid},'other','unnamed record');")
passA = len(cands)

# ---- pass B: Wikipedia hits ----
TEMPLE_EN = re.compile(r"temple|kovil|koil|devasthan|mandir|shrine|gopuram|perumal|amman", re.I)
TEMPLE_TA = re.compile(r"கோயில்|கோவில்|ஆலயம்|கோவிலூர்|திருக்கோயில்")
MENTION = re.compile(r"cuddalore|கடலூர்", re.I)
grouped = {}
for ukey, r in wiki["hits"].items():
    for lang in ("en", "ta"):
        for h in r.get(lang, []):
            rx = TEMPLE_EN if lang == "en" else TEMPLE_TA
            if rx.search(h["title"]):
                grouped.setdefault((lang, h["title"]), {"h": h, "units": set()})["units"].add(ukey)
newB = merged = dropped = 0
dropped_list = []
wsrc = {}
LISTY = re.compile(r"^list of|temples (in|of) |கோயில்கள்$|கோவில்கள்$|பட்டியல்|கோயில்களின்|\bcategory\b", re.I)  # list/category pages are not temples
for (lang, title), g in sorted(grouped.items()):
    h = g["h"]; lat, lon = h.get("lat"), h.get("lon")
    if LISTY.search(title) or "தமிழ்நாட்டில்" in title:
        dropped += 1; dropped_list.append((lang, title, "list or category page, not one temple")); continue
    snippet = re.sub(r"<[^>]+>", "", h.get("snippet", ""))
    inside = lat is not None and dpoly.contains(Point(lon, lat))
    mention = bool(MENTION.search(snippet) or MENTION.search(title))
    if lat is not None and not inside:
        dropped += 1; dropped_list.append((lang, title, "coordinates outside district")); continue
    if lat is None and not mention:
        dropped += 1; dropped_list.append((lang, title, "no coordinates and no district mention")); continue
    url = f"https://{lang}.wikipedia.org/wiki/{title.replace(' ', '_')}"
    sid = source(url, f"Wikipedia ({lang})", "CC BY-SA 4.0")
    tk = toks(title) if lang == "en" else set()
    match = None
    for c in cands:
        if h.get("qid") and c["qid"] == h["qid"]: match = c; break
        if lat is None or c["lat"] is None: continue
        d = hav(lat, lon, c["lat"], c["lon"])
        # English title shares a distinctive word with a temple <=250 m away; Tamil title only joins an UNNAMED record <=100 m away
        if (tk and d <= 250 and tk & c["toks"]) or (lang == "ta" and d <= 100 and not c["name"]): match = c; break
    if match:
        merged += 1
        evidence(match["id"], "temple_name" if lang == "en" else "temple_name_ta", title, sid, snippet[:300], f"wikipedia-{lang}")
        continue
    cid = len(cands) + 1
    place = nearest_place(lat, lon) if lat is not None else None
    if place is None and lang == "ta":  # a Tamil place name inside the title (longest wins)
        named = [p for p in pl if p["name_ta"] and p["name_ta"] in title]
        place = max(named, key=lambda p: len(p["name_ta"])) if named else None
    if place is None:  # fall back to the place that was searched
        us = sorted(u for u in g["units"] if u.startswith("place:"))
        if us: place = next((p for p in pl if "place:" + str(p["osm_id"]) == us[0]), None)
    c = {"id": cid, "tid": None, "name": title if lang == "en" else None, "lat": lat, "lon": lon, "place": place, "qid": h.get("qid"), "toks": tk}
    cands.append(c); newB += 1
    sql.append(f"INSERT INTO temple_candidates(id,name_en,name_ta,place_id,lat,lon,coordinate_basis,status) VALUES({cid},{q(c['name'])},{q(title if lang == 'ta' else None)},{place['gid'] if place else 'NULL'},{q(lat)},{q(lon)},{q('wikidata' if lat is not None else None)},'candidate');")
    if h.get("qid"): sql.append(f"INSERT INTO candidate_external_ids(candidate_id,scheme,value) VALUES({cid},'wikidata',{q(h['qid'])}) ON CONFLICT DO NOTHING;")
    evidence(cid, "temple_name" if lang == "en" else "temple_name_ta", title, sid, snippet[:300], f"wikipedia-{lang}")
    if not place: sql.append(f"INSERT INTO review_queue(candidate_id,reason,detail) VALUES({cid},'location_unresolved','Wikipedia hit with no usable place');")
    if lat is None: sql.append(f"INSERT INTO review_queue(candidate_id,reason,detail) VALUES({cid},'location_unresolved','no coordinates; district matched by text only');")
sql += ev

# ---- jobs and coverage ----
cnt = {}
for c in cands:
    if c["place"]: cnt[c["place"]["gid"]] = cnt.get(c["place"]["gid"], 0) + 1
failed_units = {k.split("_")[0] for k in []}
unit_id = 0; jid = 0
units = [("place:" + str(p["osm_id"]), p["gid"], p["name"], p["name_ta"]) for p in pl] + [("taluk:" + t, gid["taluk:" + t], t, None) for t in places["taluks"]]
for ukey, g, name, ta in units:
    unit_id += 1
    r = wiki["hits"].get(ukey, {})
    queries = [(l, h) for l in ("en", "ta") for h in ({x["q"] for x in r.get(l, [])})]
    failed = [k for k in r if k.endswith("_failed")]
    planned = 1 + len(queries) + len(failed)  # pass A + pass B queries
    ok = planned - len(failed)
    found = cnt.get(g, 0) if ukey.startswith("place:") else sum(1 for c in cands if c["place"] and next((p for p in pl if p["gid"] == c["place"]["gid"]), {}).get("taluk") == name)
    status = "BLOCKED" if failed else ("SEARCH_COMPLETE_WITH_FINDINGS" if found else "IN_PROGRESS")
    note = []
    if not ta and ukey.startswith("place:"): note.append("no Tamil name: Tamil queries not run")
    if not found: note.append("no findings: second pass (pass C) not run")
    note.append("pass C not run (needs a web-search API)")
    sql.append(f"INSERT INTO coverage_units(id,entity_id,status,tasks_planned,tasks_ok,second_pass_done,note) VALUES({unit_id},{g},{q(status)},{planned},{ok},false,{q('; '.join(note))});")
    jid += 1
    sql.append(f"INSERT INTO discovery_jobs(id,job_key,unit_id,pass,query,status,attempts,result_count) VALUES({jid},{q(f'{PIPE}:{ukey}:A')},{unit_id},'A','osm+wikidata records already in the directory','done',1,{found});")
    for l, qq in queries:
        jid += 1
        sql.append(f"INSERT INTO discovery_jobs(id,job_key,unit_id,pass,query,status,attempts,result_count) VALUES({jid},{q(f'{PIPE}:{ukey}:B:{l}:{qq}')},{unit_id},'B',{q(l + ': ' + qq)},'done',1,{len(r.get(l, []))});")
    for k in failed:
        jid += 1
        sql.append(f"INSERT INTO discovery_jobs(id,job_key,unit_id,pass,query,status,attempts,error) VALUES({jid},{q(f'{PIPE}:{ukey}:B:{k}')},{unit_id},'B','failed query','failed',3,'API did not answer after 5 tries');")
sql.append(f"SELECT setval('sources_id_seq',{len(SRC)});")
sql.append(f"SELECT setval('coverage_units_id_seq',{unit_id}); SELECT setval('discovery_jobs_id_seq',{jid}); SELECT setval('temple_candidates_id_seq',{len(cands)});")
sql.append("COMMIT;")
out = root / "tools/cache" / f"{district.lower()}-pilot.sql"
out.write_text("\n".join(sql))
(root / "tools/cache" / f"{district.lower()}-pilot-dropped.json").write_text(json.dumps(dropped_list, ensure_ascii=False, indent=0))
r = subprocess.run(["psql", DB, "-v", "ON_ERROR_STOP=1", "-q", "-f", str(out)], capture_output=True, text=True)
print(r.stderr[-800:] or "loaded")
print(f"pass A candidates {passA}; pass B new {newB}, merged into existing {merged}, dropped {dropped}; total {len(cands)}")
