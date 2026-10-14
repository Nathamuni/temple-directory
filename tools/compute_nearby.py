#!/usr/bin/env python3
"""Compute nearby-feature fields for every temple from the Geofabrik extract -> tools/cache/computed.json

  tools/.venv/bin/python -I tools/compute_nearby.py tools/cache/india-latest.osm.pbf

Straight-line distances to features that are MAPPED in OpenStreetMap. Only positive findings are stored:
a temple with no mapped toilet nearby gets no toilet entry (the map may simply be incomplete).
"""
import json, math, sys, time
from pathlib import Path
import numpy as np
import osmium, shapely
from shapely.strtree import STRtree

pbf = sys.argv[1]
root = Path(__file__).resolve().parent.parent
t0 = time.time()
log = lambda m: print(f"[{time.time() - t0:5.0f}s] {m}", flush=True)
F = osmium.filter.TagFilter(("railway", "station"), ("railway", "halt"), ("amenity", "bus_station"), ("aeroway", "aerodrome"),
                            ("amenity", "parking"), ("amenity", "toilets"), ("amenity", "drinking_water"),
                            ("amenity", "hospital"), ("amenity", "clinic"), ("amenity", "doctors"))


def kind(t):
    if t.get("railway") in ("station", "halt") and not t.get("station") in ("subway", "light_rail", "monorail"):
        return "rail"
    a = t.get("amenity")
    if a == "bus_station":
        return "bus"
    if t.get("aeroway") == "aerodrome":
        return "airport" if t.get("iata") else None
    return {"parking": "parking", "toilets": "toilets", "drinking_water": "water", "hospital": "medical", "clinic": "medical", "doctors": None}.get(a)


feat = {k: [] for k in ("rail", "bus", "airport", "parking", "toilets", "water", "medical")}
log("scanning extract for transport and facility features")
fp = osmium.FileProcessor(pbf).with_locations().with_filter(F)
for o in fp:
    if o.is_node():
        la, lo = o.location.lat, o.location.lon
    elif o.is_way():
        pts = [(n.lat, n.lon) for n in o.nodes if n.location.valid()]
        if not pts:
            continue
        la = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
        lo = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
    else:
        continue
    t = o.tags
    k = kind(t)
    if not k:
        continue
    name = t.get("name:en") or t.get("name") or ""
    if k in ("rail", "bus", "airport", "medical") and not name:
        continue  # an unnamed station is no use to a visitor
    feat[k].append((la, lo, name, t.get("iata", ""), t.get("amenity", "")))
log("features: " + ", ".join(f"{k}={len(v)}" for k, v in feat.items()))

els = json.loads((root / "india-temples.json").read_text())["elements"]
key = lambda e: f"{e['type']}/{e['id']}"
tl = np.array([(e["lat"], e["lon"]) if "lat" in e else (e["center"]["lat"], e["center"]["lon"]) for e in els])
SC = math.cos(math.radians(22))  # equirectangular scale for tree distances; true distance is recomputed by haversine


def hav(la1, lo1, la2, lo2):
    p = math.pi / 180
    a = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 12742000 * math.asin(math.sqrt(a))


tpts = shapely.points(tl[:, 1] * SC, tl[:, 0])
out = {key(e): {} for e in els}


def trees(k):
    arr = np.array([(f[0], f[1]) for f in feat[k]])
    return STRtree(shapely.points(arr[:, 1] * SC, arr[:, 0])), arr


def nearest(k, max_km, field):
    if not feat[k]:
        return
    tree, arr = trees(k)
    deg = max_km / 111.0 * 1.15
    ti, fi = tree.query_nearest(tpts, max_distance=deg, all_matches=False)
    n = 0
    for a, b in zip(ti, fi):
        d = hav(tl[a][0], tl[a][1], arr[b][0], arr[b][1])
        if d <= max_km * 1000:
            f = feat[k][b]
            v = {"name": f[2], "dist_m": round(d)}
            if k == "airport":
                v["iata"] = f[3]
            out[key(els[a])][field] = v
            n += 1
    log(f"{field}: {n} temples have one within {max_km} km")


def within(k, r_m, field):
    if not feat[k]:
        return
    tree, arr = trees(k)
    ti, fi = tree.query(tpts, predicate="dwithin", distance=r_m / 111000 * 1.15)
    best = {}
    for a, b in zip(ti, fi):
        d = hav(tl[a][0], tl[a][1], arr[b][0], arr[b][1])
        if d <= r_m:
            c = best.setdefault(a, [0, 1e9])
            c[0] += 1
            c[1] = min(c[1], d)
    for a, (n, d) in best.items():
        out[key(els[a])][field] = {"count": n, "nearest_m": round(d)}
    log(f"{field}: {len(best)} temples have one within {r_m} m")


nearest("rail", 80, "nearest_rail")
nearest("bus", 40, "nearest_bus")
nearest("airport", 300, "nearest_airport")
nearest("medical", 5, "nearest_medical")
within("parking", 300, "parking")
within("toilets", 300, "toilets")
within("water", 300, "water")

out = {k: v for k, v in out.items() if v}
(root / "tools" / "cache" / "computed.json").write_text(json.dumps(out))
log(f"wrote {len(out)} temples with at least one computed field")
