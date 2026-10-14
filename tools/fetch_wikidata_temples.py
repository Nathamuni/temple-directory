#!/usr/bin/env python3
"""Fetch every Hindu-temple item in India from Wikidata -> tools/cache/wikidata-temples.json
Run: python3 -I tools/fetch_wikidata_temples.py   (stdlib only; resumable per page)"""
import json, sys, time, urllib.parse, urllib.request
from pathlib import Path

out = Path(__file__).resolve().parent / "cache" / "wikidata-temples.json"
UA = "TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)"
PAGE = 1500


def sparql(q, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request("https://query.wikidata.org/sparql", urllib.parse.urlencode({"query": q}).encode(),
                                         {"User-Agent": UA, "Accept": "application/sparql-results+json"})
            return json.load(urllib.request.urlopen(req, timeout=120))["results"]["bindings"]
        except Exception as e:
            print(f"  retry {i + 1}: {e}", flush=True)
            time.sleep(10 * (i + 1))
    raise SystemExit("Wikidata kept failing; re-run later")


def query(offset):
    return f"""
SELECT ?t ?label ?coord ?inception ?image ?site ?article
  (GROUP_CONCAT(DISTINCT ?deityL; separator="|") AS ?deities)
  (GROUP_CONCAT(DISTINCT ?heritL; separator="|") AS ?heritage)
  (GROUP_CONCAT(DISTINCT ?styleL; separator="|") AS ?styles)
  (GROUP_CONCAT(DISTINCT ?locL; separator="|") AS ?located)
  (GROUP_CONCAT(DISTINCT ?denomL; separator="|") AS ?denom)
WHERE {{
  {{ SELECT DISTINCT ?t WHERE {{ ?t wdt:P31/wdt:P279* wd:Q842402; wdt:P17 wd:Q668 . }} ORDER BY ?t LIMIT {PAGE} OFFSET {offset} }}
  OPTIONAL {{ ?t rdfs:label ?label FILTER(lang(?label)="en") }}
  OPTIONAL {{ ?t wdt:P625 ?coord }}
  OPTIONAL {{ ?t wdt:P571 ?inception }}
  OPTIONAL {{ ?t wdt:P18 ?image }}
  OPTIONAL {{ ?t wdt:P856 ?site }}
  OPTIONAL {{ ?article schema:about ?t; schema:isPartOf <https://en.wikipedia.org/> }}
  OPTIONAL {{ ?t wdt:P825 ?d . ?d rdfs:label ?deityL FILTER(lang(?deityL)="en") }}
  OPTIONAL {{ ?t wdt:P1435 ?h . ?h rdfs:label ?heritL FILTER(lang(?heritL)="en") }}
  OPTIONAL {{ ?t wdt:P149 ?s . ?s rdfs:label ?styleL FILTER(lang(?styleL)="en") }}
  OPTIONAL {{ ?t wdt:P131 ?l . ?l rdfs:label ?locL FILTER(lang(?locL)="en") }}
  OPTIONAL {{ ?t wdt:P140 ?n . ?n rdfs:label ?denomL FILTER(lang(?denomL)="en") }}
}} GROUP BY ?t ?label ?coord ?inception ?image ?site ?article"""


def val(b, k):
    return b[k]["value"] if k in b else None


items, offset = {}, 0
while True:
    rows = sparql(query(offset))
    if not rows:
        break
    for b in rows:
        qid = val(b, "t").rsplit("/", 1)[1]
        lat = lon = None
        c = val(b, "coord")
        if c and c.startswith("Point("):
            lon, lat = (float(x) for x in c[6:-1].split())
        items[qid] = {
            "qid": qid, "label": val(b, "label"), "lat": lat, "lon": lon,
            "inception": (val(b, "inception") or "")[:10] or None,
            "image": val(b, "image"), "website": val(b, "site"),
            "wikipedia": val(b, "article"),
            "deities": [x for x in (val(b, "deities") or "").split("|") if x],
            "heritage": [x for x in (val(b, "heritage") or "").split("|") if x],
            "styles": [x for x in (val(b, "styles") or "").split("|") if x],
            "located_in": [x for x in (val(b, "located") or "").split("|") if x],
            "denomination": [x for x in (val(b, "denom") or "").split("|") if x],
        }
    print(f"offset {offset}: {len(rows)} rows, {len(items)} items", flush=True)
    if len(rows) < PAGE and len(rows) < 1:
        break
    offset += PAGE
    if offset > 40000:
        break
    time.sleep(2)

out.write_text(json.dumps(list(items.values()), ensure_ascii=False))
n = len(items)
print(f"wrote {n} items -> {out}")
for k in ("lat", "label", "deities", "inception", "image", "wikipedia", "heritage", "styles", "website"):
    c = sum(1 for i in items.values() if i[k])
    print(f"  {k:<10}{c:>7}  {100 * c / max(n, 1):5.1f}%")
