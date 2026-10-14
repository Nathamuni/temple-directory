#!/usr/bin/env python3
"""Pre-fetch licensed Wikimedia Commons photos geotagged near each temple -> tools/cache/nearby-photos.json
Stage 1: Commons geosearch (<=150 m) per temple; keep up to 3 candidates (stdlib only, resumable).
Stage 2: batch imageinfo (50 titles/call) for licence + credit + thumbnail URL.
A photo is accepted if (a) its file title mentions a temple word or the temple's own name AND it is <=150 m away,
or (b) it is <=50 m away. Everything is recorded with its distance so the UI can say how near it was.

  python3 -I tools/fetch_nearby_photos.py            # all temples (about 30-60 min)
  python3 -I tools/fetch_nearby_photos.py 500        # only the first 500 (test run)
"""
import json, re, sys, time, urllib.parse, urllib.request, html
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

root = Path(__file__).resolve().parent.parent
cache = root / "tools" / "cache"
out = cache / "nearby-photos.json"
UA = "TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)"
API = "https://commons.wikimedia.org/w/api.php"
BAD = re.compile(r"logo|locator|\bmap\b|flag|signboard|sign board|diagram|chart|plan of|stamp|coat of arms|banner|poster|screenshot|\.svg|\.pdf|\.tif", re.I)
TEMPLE_WORD = re.compile(r"temple|mandir|mandiram|kovil|koil|gopuram|gudi|devalayam|devasthan|shrine|kshetra|alayam|ammavari|swamy|perumal|isvara|eswara|ishwar|ganesh|hanuman|shiva|vishnu|krishna|devi|amman|murugan|durga|lakshmi|ayyappa|jagannath|balaji|venkatesh", re.I)
limit = int(sys.argv[1]) if len(sys.argv) > 1 else None

els = json.loads((root / "india-temples.json").read_text())["elements"]
if limit:
    els = els[:limit]
key = lambda e: f"{e['type']}/{e['id']}"
pos = lambda e: (e["lat"], e["lon"]) if "lat" in e else (e["center"]["lat"], e["center"]["lon"])
res = json.loads(out.read_text()) if out.exists() else {}
cand = res.get("_candidates", {})
final = res.get("photos", {})


def call(params, tries=5):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40))
        except Exception as e:
            time.sleep(min(30, 2 * 2 ** i))
    return None


def tokens(name):
    return {w for w in re.findall(r"[a-z]{4,}", (name or "").lower()) if w not in {"temple", "mandir", "shri", "sree", "swamy", "swami", "unnamed", "hindu", "devi"}}


def hav(la1, lo1, la2, lo2):
    import math
    p = math.pi / 180
    a = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 12742000 * math.asin(math.sqrt(a))


GENERIC = {"temple", "mandir", "shri", "sree", "swamy", "swami", "unnamed", "hindu", "devi", "kovil", "koil", "mandiram", "sivan", "shiva", "vishnu", "hanuman", "ganesh", "ganesha", "krishna", "amman", "perumal", "murugan", "durga"}


def tokens(name):
    return {w for w in re.findall(r"[a-z]{5,}", (name or "").lower()) if w not in GENERIC}


def stage1(cell_temples):
    """One geosearch per ~1 km cell; every temple in the cell is matched locally against the returned files."""
    es = cell_temples
    clat = sum(pos(e)[0] for e in es) / len(es); clon = sum(pos(e)[1] for e in es) / len(es)
    rad = max(150, min(1000, int(max(hav(clat, clon, *pos(e)) for e in es)) + 150))
    d = call({"action": "query", "list": "geosearch", "gscoord": f"{clat}|{clon}", "gsradius": rad, "gsnamespace": 6, "gslimit": 500})
    if d is None:
        return  # leave unresolved so a re-run retries
    files = [g for g in d.get("query", {}).get("geosearch", []) if re.search(r"\.(jpe?g|png|webp)$", g["title"], re.I) and not BAD.search(g["title"])]
    for e in es:
        la, lo = pos(e); t = e["tags"]; toks = tokens(t.get("name:en") or t.get("name"))
        picks = []
        for g in files:
            dist = hav(la, lo, g["lat"], g["lon"]); low = g["title"].lower()
            word = bool(TEMPLE_WORD.search(low)); named = any(w in low for w in toks)
            if dist <= 50 or (dist <= 150 and (word or named)) or (dist <= 500 and named):
                picks.append({"title": g["title"], "dist": round(dist), "title_match": word or named})
        picks.sort(key=lambda p: (not p["title_match"], p["dist"]))
        cand[key(e)] = picks[:3]


def save():
    out.write_text(json.dumps({"_candidates": cand, "photos": final}, ensure_ascii=False))


t0 = time.time()
todo = [e for e in els if key(e) not in cand]
cells = {}
for e in todo:
    la, lo = pos(e)
    cells.setdefault((round(la / 0.01), round(lo / 0.01)), []).append(e)
cells = list(cells.values())
print(f"stage 1: {len(todo)} temples to search in {len(cells)} map cells ({len(els) - len(todo)} cached)", flush=True)
with ThreadPoolExecutor(max_workers=8) as ex:
    for i, _ in enumerate(ex.map(stage1, cells), 1):
        if i % 250 == 0:
            save(); print(f"  {i}/{len(cells)} cells  {time.time() - t0:.0f}s  with candidates: {sum(1 for v in cand.values() if v)}", flush=True)
save()
print(f"stage 1 done: {sum(1 for v in cand.values() if v)} temples have at least one candidate of {len(cand)}", flush=True)

# stage 2: licence, credit, thumbnail for every distinct candidate title
titles = sorted({p["title"] for v in cand.values() for p in v})
info = {}
STRIP = re.compile(r"<[^>]+>")
batches = [titles[i:i + 50] for i in range(0, len(titles), 50)]


def stage2(b):
    d = call({"action": "query", "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 960, "titles": "|".join(b)})
    if not d:
        return
    norm = {n["to"]: n["from"] for n in d.get("query", {}).get("normalized", [])}
    for p in d.get("query", {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [None])[0]
        if not ii:
            continue
        m = ii.get("extmetadata", {})
        lic = html.unescape(STRIP.sub("", m.get("LicenseShortName", {}).get("value", "")))
        if not re.search(r"CC BY|CC0|public domain", lic, re.I):
            continue
        info[norm.get(p["title"], p["title"])] = {
            "url": ii.get("thumburl") or ii["url"], "original_url": ii["url"], "caption": p["title"].replace("File:", ""),
            "source": ii.get("descriptionurl"), "credit": html.unescape(STRIP.sub("", m.get("Artist", {}).get("value", ""))).strip()[:120] or "See source",
            "license": lic, "license_url": m.get("LicenseUrl", {}).get("value")}


print(f"stage 2: {len(titles)} candidate files in {len(batches)} batches", flush=True)
with ThreadPoolExecutor(max_workers=4) as ex:
    list(ex.map(stage2, batches))
for k, picks in cand.items():
    for p in picks:
        im = info.get(p["title"])
        if im:
            final[k] = {**im, "distance_m": p["dist"], "title_match": p["title_match"]}
            break
save()
print(f"done: {len(final)} temples have a licensed nearby photo ({100 * len(final) / max(len(cand), 1):.1f}% of {len(cand)}); title-matched: {sum(1 for v in final.values() if v['title_match'])}")
