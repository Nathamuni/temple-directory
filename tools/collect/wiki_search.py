#!/usr/bin/env python3
"""Pass B: search Wikipedia (English + Tamil) for temples around every place of a district. Official MediaWiki API, cached, resumable.
  tools/.venv/bin/python -I tools/collect/wiki_search.py Cuddalore
Output: tools/cache/<district>-wiki-hits.json  {place_key: {lang: [hits]}, "_meta": {...}} where a hit has title, snippet, coords, qid.
Places with no Tamil name get no Tamil query (recorded as skipped, not as 'no temples').
"""
import hashlib, json, sys, time, urllib.parse, urllib.request
from pathlib import Path

root = Path(__file__).resolve().parent.parent.parent
district = sys.argv[1]
data = json.loads((root / "tools" / "cache" / f"{district.lower()}-places.json").read_text())
cdir = root / "tools" / "cache" / "collect"; cdir.mkdir(exist_ok=True)
UA = "TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)"
stats = {"queries": 0, "cached": 0, "failed": 0}


def api(lang, params):
    url = f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json"})
    f = cdir / (f"wp-{lang}-" + hashlib.sha1(url.encode()).hexdigest()[:16] + ".json")
    if f.exists():
        stats["cached"] += 1
        return json.loads(f.read_text())
    for i in range(3):  # bounded retries; a query that still fails is recorded as failed, not retried forever
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=25))
            f.write_text(json.dumps(d, ensure_ascii=False)); stats["queries"] += 1; time.sleep(0.25)
            return d
        except Exception:
            time.sleep(2 * 2 ** i)
    stats["failed"] += 1
    return None


# units: every place plus every taluk
units = [{"key": f"place:{p['osm_id']}", "en": p["name"], "ta": p["name_ta"]} for p in data["places"]]
units += [{"key": f"taluk:{t}", "en": t, "ta": None} for t in data["taluks"]]
hits, skipped = {}, []
for u in units:
    r = hits.setdefault(u["key"], {})
    qs = [("en", f'{u["en"]} temple {district}')]
    if u["ta"]:
        qs.append(("ta", f'{u["ta"]} கோயில்'))
        qs.append(("ta", f'{u["ta"]} கோவில்'))
    else:
        skipped.append(u["key"])
    for lang, q in qs:
        d = api(lang, {"action": "query", "list": "search", "srsearch": q, "srlimit": 20, "srprop": "snippet"})
        if d is None:
            r.setdefault(lang + "_failed", []).append(q); continue
        r.setdefault(lang, []).extend({"title": s["title"], "snippet": s["snippet"], "q": q} for s in d["query"]["search"])

# coordinates + wikidata id for every distinct title (12 per call)
info = {}
for lang in ("en", "ta"):
    titles = sorted({h["title"] for r in hits.values() for h in r.get(lang, [])})
    for i in range(0, len(titles), 12):  # short batches: Tamil titles percent-encode to ~9 bytes per character
        d = api(lang, {"action": "query", "prop": "coordinates|pageprops", "ppprop": "wikibase_item", "coprimary": "primary",
                       "titles": "|".join(titles[i:i + 12]), "redirects": 1})
        for p in (d or {}).get("query", {}).get("pages", {}).values():
            c = (p.get("coordinates") or [None])[0]
            info[f"{lang}:{p['title']}"] = {"lat": c["lat"] if c else None, "lon": c["lon"] if c else None,
                                          "qid": p.get("pageprops", {}).get("wikibase_item"), "pageid": p.get("pageid")}
for r in hits.values():
    for lang in ("en", "ta"):
        for h in r.get(lang, []):
            h.update(info.get(f"{lang}:{h['title']}", {}))
out = {"_meta": {"district": district, "units": len(units), "skipped_no_tamil_name": skipped, "stats": stats,
                 "source": "MediaWiki API en.wikipedia.org / ta.wikipedia.org, CC BY-SA"}, "hits": hits}
(root / "tools" / "cache" / f"{district.lower()}-wiki-hits.json").write_text(json.dumps(out, ensure_ascii=False))
print(stats, f"units={len(units)} skipped_ta={len(skipped)} distinct hit titles en={sum(1 for k in info if k.startswith('en:'))} ta={sum(1 for k in info if k.startswith('ta:'))}")
