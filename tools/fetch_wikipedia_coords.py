#!/usr/bin/env python3
"""Coordinates from English Wikipedia for Wikidata temples that have an article but no P625 -> tools/cache/wikipedia-coords.json
Run after fetch_wikidata_temples.py:  python3 -I tools/fetch_wikipedia_coords.py   (stdlib only; resumable)"""
import json, time, urllib.parse, urllib.request
from pathlib import Path

cache = Path(__file__).resolve().parent / "cache"
out = cache / "wikipedia-coords.json"
UA = {"User-Agent": "TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)"}
wd = json.loads((cache / "wikidata-temples.json").read_text())
done = json.loads(out.read_text()) if out.exists() else {}  # title -> {lat, lon} or null (article has no primary coordinate)
titles = sorted({urllib.parse.unquote(w["wikipedia"].rsplit("/", 1)[1]).replace("_", " ") for w in wd if w["lat"] is None and w.get("wikipedia")} - set(done))
print(f"{len(titles)} articles to check", flush=True)


def api(batch):
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "prop": "coordinates", "coprimary": "primary", "titles": "|".join(batch), "redirects": 1, "format": "json", "formatversion": 2})
    for i in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40))["query"]
        except Exception:
            time.sleep(3 * (i + 1))
    return None


for i in range(0, len(titles), 50):
    batch = titles[i:i + 50]
    q = api(batch)
    if q is None:
        print(f"  batch {i} failed; re-run to resume", flush=True)
        continue
    back = {}  # resolved title -> requested title (normalisation and redirects)
    for k in ("normalized", "redirects"):
        for r in q.get(k, []):
            back[r["to"]] = back.get(r["from"], r["from"])
    for p in q.get("pages", []):
        c = (p.get("coordinates") or [None])[0]
        done[back.get(p["title"], p["title"])] = {"lat": c["lat"], "lon": c["lon"]} if c else None
    for t in batch:
        done.setdefault(t, None)
    out.write_text(json.dumps(done, ensure_ascii=False))
    time.sleep(0.5)
print(f"wrote {out}: {sum(1 for v in done.values() if v)} of {len(done)} articles have coordinates")
