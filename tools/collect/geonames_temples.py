#!/usr/bin/env python3
"""Download GeoNames' India dump and keep temple (TMPL) and shrine (SHRN) rows -> tools/cache/geonames-temples.json

  python3 -I tools/collect/geonames_temples.py            (stdlib only)

GeoNames (CC BY 4.0, https://www.geonames.org) does not state a religion, so merge_sources.py keeps only rows whose name reads as a
Hindu temple and drops names with another faith's words. Coordinates are GeoNames' own, usually good to about a kilometre.
"""
import io, json, urllib.request, zipfile
from pathlib import Path

out = Path(__file__).resolve().parent.parent / "cache" / "geonames-temples.json"
raw = urllib.request.urlopen(urllib.request.Request("https://download.geonames.org/export/dump/IN.zip",
                             headers={"User-Agent": "TempleDirectoryImporter/1.0"}), timeout=180).read()
rows = []
for line in zipfile.ZipFile(io.BytesIO(raw)).read("IN.txt").decode("utf-8").splitlines():
    f = line.split("\t")
    if len(f) > 8 and f[7] in ("TMPL", "SHRN"):
        rows.append({"id": int(f[0]), "name": f[1], "ascii": f[2], "alt": f[3].split(",")[:12], "lat": float(f[4]), "lon": float(f[5]), "code": f[7]})
out.write_text(json.dumps({"source": "GeoNames (CC BY 4.0)", "rows": rows}, ensure_ascii=False))
print(len(rows), "temple/shrine rows")
