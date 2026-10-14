#!/usr/bin/env python3
"""Add Wikidata temples that have no OpenStreetMap counterpart to india-temples.json as their own records.

  tools/.venv/bin/python -I tools/add_wikidata_temples.py tools/cache/india-latest.osm.pbf

Pipeline order: extract_india_temples.py -> fetch_wikidata_temples.py -> fetch_wikipedia_coords.py
  -> add_wikidata_temples.py -> compute_nearby.py -> enrich_temples.py
(re-running the extract rewrites india-temples.json from OSM, so run this step again after it).

A Wikidata item becomes a record only when it can be placed and is unlikely to duplicate an OSM temple:
  - it has coordinates (Wikidata P625, else the English Wikipedia article's primary coordinate)
  - it falls inside an Indian state boundary (same polygons and rules as the OSM extract)
  - no OSM temple within 150 m (an unmatched item that close is almost always the same temple under another name)
  - no OSM temple within 1 km whose name agrees (>= 0.6, same measure as enrich_temples.py)
Records get type "wikidata", id = the QID number, and tags.wikidata so enrich_temples.py links them exactly.
State/district polygons are cached in tools/cache/boundaries.pkl after the first (slow, ~12 min) run.
"""
import json, math, pickle, re, sys, time, unicodedata, urllib.parse
from collections import defaultdict, Counter
from difflib import SequenceMatcher
from pathlib import Path

import shapely
from shapely import Point, STRtree

root = Path(__file__).resolve().parent.parent
cache = root / "tools" / "cache"
T0 = time.time()


def log(m):
    print(f"[{time.time() - T0:7.0f}s] {m}", flush=True)


# ---- boundaries (same rules as extract_india_temples.py) ------------------------------------------
bfile = cache / "boundaries.pkl"
if bfile.exists():
    b = pickle.loads(bfile.read_bytes())
else:
    import osmium
    pbf = sys.argv[1] if len(sys.argv) > 1 else str(cache / "india-latest.osm.pbf")
    log("assembling state and district boundaries from " + pbf)
    wkb = osmium.geom.WKBFactory()
    b = {"states": ([], []), "5": ([], []), "6": ([], [])}
    for o in osmium.FileProcessor(pbf).with_locations().with_areas(osmium.filter.KeyFilter("boundary")):
        if not (o.is_area() and not o.from_way()):
            continue
        t = o.tags
        lvl = t.get("admin_level")
        if t.get("boundary") != "administrative":
            continue
        if lvl in ("5", "6") and t.get("name"):
            k = lvl
        elif lvl == "4" and t.get("ISO3166-2", "").startswith("IN-"):
            k = "states"
        else:
            continue
        try:
            b[k][1].append(shapely.to_wkb(shapely.from_wkb(wkb.create_multipolygon(o))))
            b[k][0].append(t.get("name:en") or t.get("name"))
        except Exception as e:
            log(f"  skipped boundary {t.get('name')}: {e}")
    bfile.write_bytes(pickle.dumps(b))
names, polys = b["states"][0], [shapely.from_wkb(x) for x in b["states"][1]]
if len(polys) < 30:
    sys.exit("Too few state boundaries assembled; refusing to continue (states would be mis-assigned).")
dist = {l: (b[l][0], [shapely.from_wkb(x) for x in b[l][1]]) for l in ("5", "6")}
tree = STRtree(polys)
dtrees = {l: (STRtree(v[1]) if v[1] else None) for l, v in dist.items()}
log(f"{len(polys)} states, {len(dist['5'][1])} + {len(dist['6'][1])} district polygons")


def state_of(lat, lon):
    p = Point(lon, lat)
    for i in tree.query(p, predicate="intersects"):
        return names[int(i)], "boundary"
    j = tree.nearest(p)
    if j is not None and polys[int(j)].distance(p) < 0.045:
        return names[int(j)], "nearest_boundary_5km"
    return None, None


def district_of(lat, lon):
    p = Point(lon, lat)
    for lvl in ("5", "6"):
        t = dtrees[lvl]
        if t is None:
            continue
        hits = [int(i) for i in t.query(p, predicate="intersects")]
        if hits:
            i = min(hits, key=lambda i: dist[lvl][1][i].area)
            return dist[lvl][0][i], "boundary:admin_level=" + lvl
    return None, None


# ---- name similarity (same as enrich_temples.py) ----------------------------------------------------
GENERIC = re.compile(r"\b(sri|shri|sree|temple|mandir|mandiram|kovil|koil|devasthanam|devalayam|devalaya|"
                     r"kshetram|kshetra|ksetram|gudi|of|the|and|hindu|shrine|devi|swamy|swami|temples)\b", re.I)


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").lower()
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^\w]+", " ", GENERIC.sub(" ", s)).strip()


def sim(a, b):
    a, b = norm(a), norm(b)
    return 0.0 if not a or not b else 1.0 if a == b else SequenceMatcher(None, a, b).ratio()


def hav(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742000 * math.asin(math.sqrt(a))


# ---- candidates --------------------------------------------------------------------------------------
data = json.loads((root / "india-temples.json").read_text())
osm = [e for e in data["elements"] if e["type"] != "wikidata"]  # idempotent: drop records added by an earlier run
present = {e["tags"].get("wikidata") for e in osm}
wd = json.loads((cache / "wikidata-temples.json").read_text())
wpc = json.loads((cache / "wikipedia-coords.json").read_text()) if (cache / "wikipedia-coords.json").exists() else {}

CELL = 0.01  # ~1.1 km grid
grid = defaultdict(list)
for e in osm:
    la, lo = (e["lat"], e["lon"]) if "lat" in e else (e["center"]["lat"], e["center"]["lon"])
    grid[(int(la / CELL), int(lo / CELL))].append((la, lo, e["tags"]))

why, added = Counter(), []
for w in wd:
    if w["qid"] in present:
        why["already linked by an OSM wikidata tag"] += 1
        continue
    lat, lon, coord_src = w["lat"], w["lon"], "wikidata"
    title = urllib.parse.unquote(w["wikipedia"].rsplit("/", 1)[1]).replace("_", " ") if w.get("wikipedia") else None
    if lat is None and title and wpc.get(title):
        lat, lon, coord_src = wpc[title]["lat"], wpc[title]["lon"], "wikipedia"
    if lat is None:
        why["no coordinates on Wikidata or Wikipedia"] += 1
        continue
    if not w["label"] or re.fullmatch(r"Q\d+", w["label"]):
        why["no English label"] += 1
        continue
    near, named_dup = 9e9, False
    cx, cy = int(lat / CELL), int(lon / CELL)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for la, lo, t in grid.get((cx + dx, cy + dy), []):
                d = hav(lat, lon, la, lo)
                near = min(near, d)
                if d <= 1000 and max(sim(w["label"], t.get("name:en", "")), sim(w["label"], t.get("name", ""))) >= 0.6:
                    named_dup = True
    if near < 150:
        why["OSM temple within 150 m (likely the same temple)"] += 1
        continue
    if named_dup:
        why["OSM temple with the same name within 1 km"] += 1
        continue
    st, sbasis = state_of(lat, lon)
    if not st:
        why["outside India's state boundaries"] += 1
        continue
    d, dbasis = district_of(lat, lon)
    tags = {"name": w["label"], "religion": "hindu", "amenity": "place_of_worship", "wikidata": w["qid"]}
    if title:
        tags["wikipedia"] = "en:" + title
    el = {"type": "wikidata", "id": int(w["qid"][1:]), "lat": lat, "lon": lon, "coord_source": coord_src, "tags": tags,
          "state": st, "state_basis": sbasis}
    if d:
        el["district"], el["district_basis"] = d, dbasis
    added.append(el)
    why["added"] += 1

data["elements"] = osm + added
(root / "india-temples.json").write_text(json.dumps(data, ensure_ascii=False))
log(f"{len(osm)} OSM temples + {len(added)} Wikidata temples = {len(data['elements'])}")
for k, v in why.most_common():
    print(f"  {v:>6}  {k}")
print("  by state:", Counter(e["state"] for e in added).most_common(8))
print("  coordinates from Wikipedia:", sum(1 for e in added if e["coord_source"] == "wikipedia"), "| no district:", sum(1 for e in added if "district" not in e))
