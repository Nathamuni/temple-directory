#!/usr/bin/env python3
"""PROVISIONAL location master for one district, from OpenStreetMap (not official; no LGD codes).
Writes tools/cache/<district>-places.json: the district, its taluks (admin_level 6 inside it) and every place=* node inside it.

  tools/.venv/bin/python -I tools/collect/osm_places.py Cuddalore
"""
import json, pickle, sys, time
from pathlib import Path
import osmium
from shapely import wkb
from shapely.geometry import Point
from shapely.prepared import prep

root = Path(__file__).resolve().parent.parent.parent
want = sys.argv[1]
pbf = root / "tools" / "cache" / "india-latest.osm.pbf"
d = pickle.load(open(root / "tools" / "cache" / "boundaries.pkl", "rb"))
n5, p5 = d["5"]; n6, p6 = d["6"]
idx = [k for k, n in enumerate(n5) if n == want or n.startswith(want)]
assert len(idx) == 1, f"district match for {want}: {[n5[k] for k in idx]}"
dist_poly = wkb.loads(p5[idx[0]]); dist_name = n5[idx[0]]
pd = prep(dist_poly)
taluks = []
for k in range(len(n6)):
    g = wkb.loads(p6[k])
    if g.intersects(dist_poly) and g.intersection(dist_poly).area / g.area > 0.5:
        taluks.append((n6[k], g, prep(g)))
print(f"{dist_name}: {len(taluks)} taluks (provisional, from OSM admin_level=6)", flush=True)

PLACES = {"city", "town", "village", "hamlet", "suburb", "neighbourhood", "quarter", "locality", "isolated_dwelling"}
minx, miny, maxx, maxy = dist_poly.bounds
out = []
t0 = time.time()
for o in osmium.FileProcessor(str(pbf), osmium.osm.NODE).with_filter(osmium.filter.KeyFilter("place")):
    t = o.tags
    pl = t.get("place")
    if pl not in PLACES or not t.get("name"):
        continue
    lon, lat = o.location.lon, o.location.lat
    if not (minx <= lon <= maxx and miny <= lat <= maxy) or not pd.contains(Point(lon, lat)):
        continue
    pt = Point(lon, lat)
    tk = next((n for n, g, pg in taluks if pg.contains(pt)), None)
    out.append({"osm_id": o.id, "place": pl, "name": t.get("name:en") or t.get("name"), "name_raw": t.get("name"),
                "name_ta": t.get("name:ta") or (t.get("name") if any("஀" <= ch <= "௿" for ch in t.get("name", "")) else None),
                "alt": [v for k in ("alt_name", "old_name", "name:en", "alt_name:en", "official_name") for v in [t.get(k)] if v and v != t.get("name")],
                "lat": lat, "lon": lon, "taluk": tk, "population": t.get("population")})
print(f"{len(out)} places in {time.time() - t0:.0f}s", flush=True)
res = {"district": dist_name, "basis": "PROVISIONAL: OpenStreetMap admin boundaries and place nodes; no LGD codes; not an official list",
       "taluks": sorted(n for n, _, _ in taluks), "places": out}
(root / "tools" / "cache" / f"{want.lower()}-places.json").write_text(json.dumps(res, ensure_ascii=False))
from collections import Counter
print(Counter(p["place"] for p in out)); print(Counter(p["taluk"] for p in out))
