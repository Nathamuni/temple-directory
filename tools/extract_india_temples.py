#!/usr/bin/env python3
"""Extract every Hindu temple from Geofabrik's India extract (no Overpass needed).

  tools/.venv/bin/python -I tools/extract_india_temples.py tools/cache/india-latest.osm.pbf

Writes india-temples.json (combined), data/states/<state>.json and data/states/index.json.
State is assigned by point-in-polygon against the admin_level=4 boundaries inside the same file;
temples that fall in no Indian state (neighbouring-country spill-over, sea) are dropped.
"""
import json, re, sys, time
from pathlib import Path
import osmium
import shapely
from shapely.geometry import Point
from shapely.strtree import STRtree

pbf = sys.argv[1]
root = Path(__file__).resolve().parent.parent
t0 = time.time()
log = lambda m: print(f"[{time.time() - t0:6.0f}s] {m}", flush=True)


def is_temple(tags):
    return tags.get("religion") == "hindu" and (tags.get("amenity") == "place_of_worship" or tags.get("building") == "temple")


# ---- pass 1: state boundaries -------------------------------------------------------------------
log("pass 1: assembling state boundaries")
wkb = osmium.geom.WKBFactory()
names, polys = [], []
dist = {"5": ([], []), "6": ([], [])}  # admin_level -> (names, polygons)
rejected = []
fp = osmium.FileProcessor(pbf).with_locations().with_areas(osmium.filter.KeyFilter("boundary"))
for o in fp:
    if o.is_area() and not o.from_way():
        t = o.tags
        lvl = t.get("admin_level")
        if t.get("boundary") == "administrative" and lvl in ("5", "6") and t.get("name"):
            try:
                dist[lvl][0].append(t.get("name:en") or t.get("name"))
                dist[lvl][1].append(shapely.from_wkb(wkb.create_multipolygon(o)))
            except Exception:
                pass
            continue
        if t.get("boundary") == "administrative" and lvl == "4" and not t.get("ISO3166-2", "").startswith("IN-"):
            rejected.append(t.get("name:en") or t.get("name"))
        if t.get("boundary") == "administrative" and lvl == "4" and t.get("ISO3166-2", "").startswith("IN-"):
            try:
                polys.append(shapely.from_wkb(wkb.create_multipolygon(o)))
                names.append(t.get("name:en") or t.get("name"))
            except Exception as e:  # broken multipolygon: report, never hide
                log(f"  skipped boundary {t.get('name')}: {e}")
log(f"  {len(polys)} state/UT boundaries: {sorted(names)}")
log(f"  district polygons: level5={len(dist['5'][1])} level6={len(dist['6'][1])}; level-4 areas rejected (no IN- ISO code): {sorted(set(rejected))[:20]}")
if len(polys) < 30:
    sys.exit("Too few state boundaries assembled; refusing to continue (states would be mis-assigned).")
tree = STRtree(polys)
dtrees = {l: (STRtree(v[1]) if v[1] else None) for l, v in dist.items()}
ALL_STATES = ["Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Ladakh","Lakshadweep","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"]


def district_of(lat, lon):
    p = Point(lon, lat)
    for lvl in ("5", "6"):
        t = dtrees[lvl]
        if t is None:
            continue
        hits = [int(i) for i in t.query(p, predicate="intersects")]
        if hits:  # smallest containing polygon is the most specific
            i = min(hits, key=lambda i: dist[lvl][1][i].area)
            return dist[lvl][0][i], "boundary:admin_level=" + lvl
    return None, None


def state_of(lat, lon, tags=None):
    p = Point(lon, lat)
    for i in tree.query(p, predicate="intersects"):
        return names[int(i)], "boundary"
    # outside every assembled boundary: trust an explicit addr:state naming a real Indian state
    claimed = (tags or {}).get("addr:state", "").strip().lower()
    for st in ALL_STATES:
        if claimed == st.lower():
            return st, "addr:state_tag"
    # coastal/edge slivers: nearest state within ~5 km
    j = tree.nearest(p)
    if j is not None and polys[int(j)].distance(p) < 0.045:
        return names[int(j)], "nearest_boundary_5km"
    return None, None


# ---- pass 2: temples ----------------------------------------------------------------------------
log("pass 2: collecting temples")
found, no_loc, dropped = [], 0, []
fp = osmium.FileProcessor(pbf).with_locations().with_areas(osmium.filter.KeyFilter("religion")).with_filter(osmium.filter.KeyFilter("religion"))
for o in fp:
    if o.is_node():
        kind = "node"
    elif o.is_way():
        kind = "way"
    elif o.is_area() and not o.from_way():
        kind = "relation"
    else:
        continue  # closed ways are already reported as ways
    if not is_temple(o.tags):
        continue
    tags = {t.k: t.v for t in o.tags}
    if kind == "node":
        lat, lon = o.location.lat, o.location.lon
        el = {"type": "node", "id": o.id, "lat": lat, "lon": lon, "tags": tags}
    else:
        pts = []
        try:
            if kind == "way":
                pts = [(n.lat, n.lon) for n in o.nodes if n.location.valid()]
            else:
                b = shapely.from_wkb(wkb.create_multipolygon(o)).bounds  # (minx, miny, maxx, maxy)
                pts = [(b[1], b[0]), (b[3], b[2])]
        except Exception:
            pass
        if not pts:
            no_loc += 1
            continue
        la = [p[0] for p in pts]; lo = [p[1] for p in pts]
        lat, lon = (min(la) + max(la)) / 2, (min(lo) + max(lo)) / 2  # bbox centre, same as Overpass `out center`
        el = {"type": kind, "id": o.id if kind == "way" else (o.orig_id()), "center": {"lat": lat, "lon": lon}, "tags": tags}
    st, basis = state_of(lat, lon, tags)
    if st:
        el["state"], el["state_basis"] = st, basis
        d, dbasis = district_of(lat, lon)
        if d:
            el["district"], el["district_basis"] = d, dbasis
        found.append(el)
    else:
        dropped.append({"type": kind, "id": el["id"], "lat": lat, "lon": lon, "name": tags.get("name"), "addr:state": tags.get("addr:state")})
(root / "tools" / "dropped.json").write_text(json.dumps(dropped, indent=1, ensure_ascii=False))
log(f"  dropped {len(dropped)} outside India (see tools/dropped.json)")
log(f"  {len(found)} temples inside Indian states; {no_loc} skipped for missing geometry")

# de-duplicate by type/id (areas can repeat) and write
uniq = {f"{e['type']}/{e['id']}": e for e in found}
elements = list(uniq.values())
(root / "india-temples.json").write_text(json.dumps({"version": 0.6, "generator": "extract_india_temples.py", "osm3s": {"copyright": "© OpenStreetMap contributors, ODbL 1.0"}, "elements": elements}))
d = root / "data" / "states"; d.mkdir(parents=True, exist_ok=True)
by = {}
for e in elements:
    by.setdefault(e["state"], []).append(e)
index = []
for name, els in sorted(by.items()):
    f = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") + ".json"
    (d / f).write_text(json.dumps({"state": name, "count": len(els), "copyright": "© OpenStreetMap contributors, ODbL 1.0", "elements": els}, indent=1, ensure_ascii=False))
    index.append({"state": name, "file": f, "count": len(els)})
(d / "index.json").write_text(json.dumps({"total": len(elements), "states": index}, indent=1, ensure_ascii=False))
log(f"wrote {len(elements)} temples across {len(index)} states")
for r in sorted(index, key=lambda r: -r["count"]):
    print(f"  {r['state']:<40}{r['count']:>7}")
