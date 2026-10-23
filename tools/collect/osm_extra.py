#!/usr/bin/env python3
"""Find Hindu temples in the OSM India extract that extract_india_temples.py leaves out.

  python3 -I tools/collect/osm_extra.py [tools/cache/india-latest.osm.pbf]   (needs osmium + shapely)

The main extract keeps only religion=hindu with amenity=place_of_worship or building=temple. Still real temples, still skipped:
  hindu_other   religion=hindu mapped with another key (shrine, historic, ruins ...)
  untagged_pow  amenity=place_of_worship with NO religion tag whose name is a Hindu temple word (temple, kovil, mandir ...)
  untagged_bld  building=temple with no religion tag and a Hindu-looking name
Writes tools/cache/osm-extra.json (Overpass-style elements, state/district from tools/cache/boundaries.pkl, same rules as
the main extract). Nothing already in india-temples.json is repeated.
"""
import json, pickle, re, sys, time
from collections import Counter
from pathlib import Path

import osmium, shapely
from shapely import Point, STRtree

root = Path(__file__).resolve().parent.parent.parent
cache = root / "tools" / "cache"
pbf = sys.argv[1] if len(sys.argv) > 1 else str(cache / "india-latest.osm.pbf")
T0 = time.time()
log = lambda m: print(f"[{time.time() - T0:6.0f}s] {m}", flush=True)

b = pickle.loads((cache / "boundaries.pkl").read_bytes())
names, polys = b["states"][0], [shapely.from_wkb(x) for x in b["states"][1]]
dist = {l: (b[l][0], [shapely.from_wkb(x) for x in b[l][1]]) for l in ("5", "6")}
tree = STRtree(polys)
dtrees = {l: (STRtree(v[1]) if v[1] else None) for l, v in dist.items()}


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


HINDU_WORD = re.compile(
    r"temple|mandir|mandhir|mandira|kovil|koil|kovvil|devalay|devasthan|devasthanam|gudi\b|amman|ammavaru|ammavari|ayyanar|ayyappa|"
    r"murugan|perumal|shiva|siva\b|vishnu|hanuman|anjaneya|ganesh|ganapathi|vinayaga|pillayar|krishna|rama\b|durga|kali\b|mata\b|"
    r"mahadev|balaji|venkateswara|narasimha|lakshmi|saraswati|bhagavathy|bhagwati|devi\b|math\b|ashram|"
    r"கோவில்|கோயில்|ஆலயம்|मंदिर|मन्दिर|देवालय|దేవాలయం|గుడి|ఆలయం|ದೇವಸ್ಥಾನ|ದೇವಾಲಯ|ಗುಡಿ|ക്ഷേത്രം|അമ്പലം|মন্দির|મંદિર|ମନ୍ଦିର|ਮੰਦਰ",
    re.I)
OTHER_FAITH = re.compile(r"church|chapel|mosque|masjid|dargah|dargha|gurudwara|gurdwara|buddh|vihar|jain|basadi|derasar|monastery|gompa|"
                         r"cathedral|fire temple|agiary|synagogue|pagoda|mazar|idgah|kabristan|cross\b|"
                         r"தேவாலயம்|மசூதி|चर्च|मस्जिद|गुरुद्वारा|ചർച്ച്|പള്ളി|చర్చి|ಚರ್ಚ್|মসজিদ", re.I)

seen = {f"{e['type']}/{e['id']}" for e in json.loads((root / "india-temples.json").read_text())["elements"] if e["type"] != "wikidata"}
log(f"{len(seen)} OSM objects already in india-temples.json")


def classify(t):
    rel = t.get("religion")
    if rel == "hindu":
        if t.get("amenity") == "place_of_worship" or t.get("building") == "temple":
            return None  # the main extract already takes these
        if any(k in t for k in ("amenity", "building", "historic", "tourism", "man_made", "shrine")) or t.get("name"):
            return "hindu_other"
        return None
    if rel:
        return None
    name = " ".join(t.get(k, "") for k in ("name", "name:en", "name:ta", "name:hi", "name:te", "name:kn", "name:ml", "alt_name"))
    if not name.strip() or OTHER_FAITH.search(name) or t.get("denomination") in ("christian", "muslim"):
        return None
    if t.get("amenity") == "place_of_worship" and HINDU_WORD.search(name):
        return "untagged_pow"
    if t.get("building") == "temple" and HINDU_WORD.search(name):
        return "untagged_bld"
    return None


wkb = osmium.geom.WKBFactory()
found, no_loc, dropped, counts = {}, 0, 0, Counter()
fp = osmium.FileProcessor(pbf).with_locations().with_areas(osmium.filter.KeyFilter("religion", "amenity", "building")) \
    .with_filter(osmium.filter.KeyFilter("religion", "amenity", "building"))
for o in fp:
    if o.is_node():
        kind = "node"
    elif o.is_way():
        kind = "way"
    elif o.is_area() and not o.from_way():
        kind = "relation"
    else:
        continue
    tg = o.tags
    if not (tg.get("religion") or tg.get("amenity") == "place_of_worship" or tg.get("building") == "temple"):
        continue
    tags = {t.k: t.v for t in tg}
    cls = classify(tags)
    if not cls:
        continue
    if kind == "node":
        lat, lon = o.location.lat, o.location.lon
        oid = o.id
    else:
        try:
            if kind == "way":
                pts = [(n.lat, n.lon) for n in o.nodes if n.location.valid()]
            else:
                bb = shapely.from_wkb(wkb.create_multipolygon(o)).bounds
                pts = [(bb[1], bb[0]), (bb[3], bb[2])]
        except Exception:
            pts = []
        if not pts:
            no_loc += 1
            continue
        la = [p[0] for p in pts]; lo = [p[1] for p in pts]
        lat, lon = (min(la) + max(la)) / 2, (min(lo) + max(lo)) / 2
        oid = o.id if kind == "way" else o.orig_id()
    key = f"{kind}/{oid}"
    if key in seen or key in found:
        continue
    st, basis = state_of(lat, lon)
    if not st:
        dropped += 1
        continue
    el = {"type": kind, "id": oid, "tags": tags, "state": st, "state_basis": basis, "extra_class": cls}
    if kind == "node":
        el["lat"], el["lon"] = lat, lon
    else:
        el["center"] = {"lat": lat, "lon": lon}
    d, dbasis = district_of(lat, lon)
    if d:
        el["district"], el["district_basis"] = d, dbasis
    found[key] = el
    counts[cls] += 1
    if len(found) % 2000 == 0:
        log(f"  {len(found)} found {dict(counts)}")

out = list(found.values())
(cache / "osm-extra.json").write_text(json.dumps({"generator": "collect/osm_extra.py", "copyright": "© OpenStreetMap contributors, ODbL 1.0", "elements": out}, ensure_ascii=False))
log(f"{len(out)} extra temples {dict(counts)}; {dropped} outside India; {no_loc} without geometry")
print("  named:", sum(1 for e in out if e["tags"].get("name")), "| by state:", Counter(e["state"] for e in out).most_common(8))
