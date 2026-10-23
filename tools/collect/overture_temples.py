#!/usr/bin/env python3
"""Fetch Hindu places of worship in India from the Overture Maps "places" theme.

  python3 -I tools/collect/overture_temples.py [release]      (needs duckdb; reads ~1 GB of remote parquet, ~2 min)

Overture's places are open data (CDLA-Permissive-2.0; the Meta source records carry that licence, Foursquare's Apache-2.0).
Kept inside an India bounding box with an Indian address: category hindu_place_of_worship, plus places filed as religious_organization,
historic_site, monument, landmark_and_historical_building or with no category whose name carries a temple word (temple, mandir, kovil ...). Writes
tools/cache/overture-temples.json {release, rows:[{id, name, common:{lang:name}, lat, lon, confidence, locality, region, postcode, addr, sources}]}.
Names, positions and the public address fields only; attribution: "Overture Maps Foundation, CDLA-Permissive-2.0".
"""
import json, sys
from pathlib import Path

import duckdb

release = sys.argv[1] if len(sys.argv) > 1 else "2026-10-21.0"
out = Path(__file__).resolve().parent.parent / "cache" / "overture-temples.json"
c = duckdb.connect()
c.execute("install httpfs; load httpfs; install spatial; load spatial; set s3_region='us-west-2'")
p = f"s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*"
rows = c.execute(f"""select id, names.primary, taxonomy.primary, names.common, confidence, ST_Y(geometry), ST_X(geometry), addresses[1].freeform, addresses[1].locality,
  addresses[1].region, addresses[1].postcode, sources
  from read_parquet('{p}', hive_partitioning=1)
  where bbox.xmin between 68 and 98 and bbox.ymin between 6 and 37 and addresses[1].country='IN' and (taxonomy.primary='hindu_place_of_worship' or (coalesce(taxonomy.primary,'') in ('religious_organization','historic_site','monument','landmark_and_historical_building','')
    and regexp_matches(names.primary, '(?i)\\b(temple|mandir|mandhir|kovil|koil|devasthan|devalayam|gudi)\\b|கோவில்|கோயில்|मंदिर|ఆలయం|దేవాలయం|ದೇವಸ್ಥಾನ|ക്ഷേത്രം')))""").fetchall()
res = []
for i, name, cat, common, conf, lat, lon, addr, loc, reg, pin, src in rows:
    res.append({"id": i, "name": name, "cat": cat, "common": dict(common) if common else {}, "confidence": conf, "lat": lat, "lon": lon, "addr": addr,
                "locality": loc, "region": reg, "postcode": pin, "sources": sorted({s["dataset"] for s in src}) if src else []})
out.write_text(json.dumps({"release": release, "rows": res}, ensure_ascii=False))
print(len(res), "Hindu places of worship from Overture", release)
