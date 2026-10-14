#!/usr/bin/env python3
"""Merge Wikidata + Wikipedia + name-derived hints into india-temples.json (stdlib only).

  python3 -I tools/enrich_temples.py            # uses tools/cache/*.json, writes enriched files
  python3 -I tools/enrich_temples.py --no-wiki  # skip Wikipedia summary fetch

Every added value carries its basis, so sourced and inferred facts are never mixed:
  wikidata_link   OSM record's own wikidata tag equals the item            (exact)
  spatial_name    Wikidata item <=150 m away AND names agree (>=0.6)         (probable)
  spatial_close   Wikidata item <=25 m away, OSM record unnamed               (probable)
  name_keyword    deity guessed from the temple's name                       (INFERRED)
"""
import json, math, re, sys, time, unicodedata, urllib.parse, urllib.request
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

root = Path(__file__).resolve().parent.parent
cache = root / "tools" / "cache"
UA = "TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)"
elements = json.loads((root / "india-temples.json").read_text())["elements"]
for _e in elements:  # re-runs must start from raw OSM data, never from a previous enrichment
    _e.pop("enrich", None)
    _e.pop("completeness", None)
    _e.pop("computed", None)
def _opt(name):
    f = cache / name
    return json.loads(f.read_text()) if f.exists() else {}
nearby = _opt("nearby-photos.json")        # photos: {type/id: {...}}, _candidates: {type/id: [...]}
searched = nearby.get("_candidates", {})
photos = nearby.get("photos", {})
computed = _opt("computed.json")            # {type/id: {nearest_rail: ..., toilets: ...}}
wd_extra = _opt("wikidata-extra.json")      # {qid: {circuits: [...], operator: [...], owner: [...]}}
wd = json.loads((cache / "wikidata-temples.json").read_text())
by_q = {w["qid"]: w for w in wd}

# ---------------------------------------------------------------- helpers
GENERIC = re.compile(r"\b(sri|shri|sree|temple|mandir|mandiram|kovil|koil|devasthanam|devalayam|devalaya|"
                     r"kshetram|kshetra|ksetram|gudi|of|the|and|hindu|shrine|devi|swamy|swami|temples)\b", re.I)


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").lower()
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = GENERIC.sub(" ", s)
    return re.sub(r"[^\w]+", " ", s).strip()


def sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def hav(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742000 * math.asin(math.sqrt(a))


def pos(e):
    return (e["lat"], e["lon"]) if "lat" in e else (e["center"]["lat"], e["center"]["lon"])


# ---------------------------------------------------------------- 1. match Wikidata <-> OSM
CELL = 0.002  # ~220 m grid
grid = defaultdict(list)
for i, e in enumerate(elements):
    la, lo = pos(e)
    grid[(int(la / CELL), int(lo / CELL))].append(i)

matched = {}  # osm index -> (qid, basis, distance)
qid_taken = {}
for i, e in enumerate(elements):
    q = e["tags"].get("wikidata", "")
    if re.fullmatch(r"Q\d+", q) and q in by_q:
        matched[i] = (q, "wikidata_link", 0)
        qid_taken[q] = i
for w in wd:
    if w["qid"] in qid_taken or w["lat"] is None:
        continue
    cx, cy = int(w["lat"] / CELL), int(w["lon"] / CELL)
    best = None
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for i in grid.get((cx + dx, cy + dy), []):
                if i in matched:
                    continue
                la, lo = pos(elements[i])
                d = hav(w["lat"], w["lon"], la, lo)
                if d > 150:
                    continue
                t = elements[i]["tags"]
                s = max(sim(w["label"], t.get("name:en", "")), sim(w["label"], t.get("name", "")))
                unnamed = not (t.get("name") or t.get("name:en"))
                basis = "spatial_name" if s >= 0.6 else ("spatial_close" if unnamed and d <= 25 else None)
                if basis and (best is None or (s, -d) > (best[3], -best[2])):
                    best = (i, basis, d, s)
    if best:
        matched[best[0]] = (w["qid"], best[1], round(best[2]))
        qid_taken[w["qid"]] = best[0]

# ---------------------------------------------------------------- 2. deity from name (INFERRED)
DEITIES = [
    ("Hanuman", r"hanuman|anjaneya|anjaneyar|maruti|bajrang|हनुमान|ஆஞ்சநேய|ഹനുമാൻ|ഹനുമാന്"),
    ("Ganesha", r"ganesh|ganapati|ganapathi|vinayak|vinayaga|pillaiyar|vigneshwar|vighneshwar|गणेश|விநாயக|பிள்ளையார்|ഗണപതി"),
    ("Shiva", r"shiv(?!aji)|siva\b|mahadev|mahadeva|eshwar|ishwar|isvara|nataraja|nageshwar|rameshwar|lingam|shivalaya|महादेव|शिव(?!ाजी)|சிவன்|சிவ|ശിവ|మహాదేవ|ಶಿವ"),
    ("Vishnu", r"vishnu|perumal|chennakesava|keshava|kesava|channakesava|narayan|venkatesh|balaji|tirupati|ranganath|vittal|vithoba|vithal|विष्णु|பெருமாள்|വിഷ്ണു|നാരായണ"),
    ("Krishna", r"(?<!rama)krishna|(?<!rama)krishn|radha|iskcon|gopal|govind|guruvayur|(?<!राम)कृष्ण|கிருஷ்ண|കൃഷ്ണ"),
    ("Rama", r"\bram\b|\brama\b|ramar|raghunath|sita|सीता|राम\b|ராமர்|രാമ"),
    ("Murugan", r"murugan|subrahman|subramani|subramanya|karthikeya|kartikeya|skanda|kumaraswamy|muruga|முருகன்|സുബ്രഹ്മണ്യ"),
    ("Durga", r"durga|दुर्गा|துர்கை|ദുർഗ"),
    ("Kali", r"\bkali\b|kalika|mahakali|काली|காளி|കാളി"),
    ("Lakshmi", r"lakshmi|laxmi|mahalakshmi|लक्ष्मी|லட்சுமி|ലക്ഷ്മി"),
    ("Saraswati", r"saraswati|sarasvati|सरस्वती"),
    ("Ayyappa", r"ayyappa|ayyappan|sabarimala|ശാസ്താ|അയ്യപ്പ|ஐயப்பன்"),
    ("Jagannath", r"jagannath|jagannatha|जगन्नाथ"),
    ("Narasimha", r"narasimha|narasingh|lakshmi narasimha"),
    ("Surya", r"surya|sun temple|सूर्य"),
    ("Shani", r"shani|\bsani\b|shanishwar|शनि"),
    ("Sai Baba", r"sai baba|shirdi|साईं|साई बाबा"),
    ("Amman (Tamil goddess)", r"amman|mariamman|mariyamman|அம்மன்|ಅಮ್ಮ"),
    ("Devi (goddess, unspecified)", r"bhagavathy|bhagavati|bhagwati|bhagawathi|ഭഗവതി|devi\b|देवी|\bmata\b|माता"),
    ("Venkateswara", r"venkateswara|venkateshwara|tirumala|వెంకటేశ్వర"),
    ("Jain-Hindu syncretic / other", r"^$"),
]
DEITIES = [(n, re.compile(p, re.I)) for n, p in DEITIES if p != r"^$"]


# Not deity temples: ashrams, missions, associations ("mandal"), trusts, memorials, schools.
NOT_A_TEMPLE = re.compile(r"ashram|aashram|आश्रम|mission|mandal\b|मंडळ|मंडल|samaj|समाज|samadhi|समाधि|trust|sabha|school|college|vidyalaya|hospital|bhavan|hall\b", re.I)


def infer_deity(t):
    text = " ".join(filter(None, [t.get("name:en"), t.get("name"), t.get("alt_name"), t.get("old_name")]))
    if NOT_A_TEMPLE.search(text):
        return []
    hits = [n for n, rx in DEITIES if rx.search(text)]
    generic = "Devi (goddess, unspecified)"
    if generic in hits and len(hits) > 1:  # "Devi" is often a consort ("Sri Devi Bhudevi Sametha ...") or an honorific
        hits.remove(generic)
    return hits[:2]


# ---------------------------------------------------------------- 3. Wikipedia summaries
def wikipedia_title(e, w):
    t = e["tags"].get("wikipedia", "")
    if t.startswith("en:"):
        return t[3:]
    if w and w.get("wikipedia"):
        return urllib.parse.unquote(w["wikipedia"].rsplit("/", 1)[1])
    return None


summ_file = cache / "wikipedia-summaries.json"
summaries = json.loads(summ_file.read_text()) if summ_file.exists() else {}


def fetch_summary(title):
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title.replace(" ", "_"), safe="")
    for i in range(3):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30))
            return {"extract": d.get("extract"), "url": d.get("content_urls", {}).get("desktop", {}).get("page"), "title": d.get("title")}
        except urllib.error.HTTPError as ex:
            if ex.code == 404:
                return None
            time.sleep(3 * (i + 1))
        except Exception:
            time.sleep(3 * (i + 1))
    return None


want = {}
for i, e in enumerate(elements):
    w = by_q.get(matched[i][0]) if i in matched else None
    t = wikipedia_title(e, w)
    if t:
        want[i] = t
if "--no-wiki" not in sys.argv:
    todo = [t for t in set(want.values()) if t not in summaries]
    print(f"fetching {len(todo)} Wikipedia summaries ({len(want)} temples have an article)", flush=True)
    for n, t in enumerate(todo):
        summaries[t] = fetch_summary(t)
        if n % 100 == 0:
            summ_file.write_text(json.dumps(summaries, ensure_ascii=False))
            print(f"  {n}/{len(todo)}", flush=True)
        time.sleep(0.2)
    summ_file.write_text(json.dumps(summaries, ensure_ascii=False))

# ---------------------------------------------------------------- 4. write enrichment + completeness
stats = defaultdict(int)
for i, e in enumerate(elements):
    t = e["tags"]
    en = {}
    w = None
    if i in matched:
        q, basis, dist = matched[i]
        w = by_q[q]
        en["wikidata"] = {"qid": q, "basis": basis, "distance_m": dist}
        if w["deities"]:
            en["deity"] = {"values": w["deities"], "source": "wikidata", "basis": basis}
        for k, out in (("inception", "founded"), ("heritage", "heritage"), ("styles", "architecture"), ("denomination", "denomination"), ("located_in", "located_in")):
            if w[k]:
                en[out] = {"value": w[k], "source": "wikidata", "basis": basis}
        if w["image"]:
            en["image_commons"] = w["image"]
        if w["website"]:
            en["website"] = w["website"]
        if w["label"] and not (t.get("name") or t.get("name:en")):
            en["name_en"] = {"value": w["label"], "source": "wikidata", "basis": basis}
    if "deity" not in en:
        d = t.get("deity") or t.get("dedication")
        if d:
            en["deity"] = {"values": [d], "source": "openstreetmap", "basis": "osm_tag"}
        else:
            g = infer_deity(t)
            if g:
                en["deity"] = {"values": g, "source": "name_keyword", "basis": "INFERRED_from_name"}
    k = f"{e['type']}/{e['id']}"
    ex = wd_extra.get(en.get("wikidata", {}).get("qid")) if en.get("wikidata", {}).get("basis") in ("wikidata_link", "spatial_name") else None
    if ex:
        if ex.get("circuits"):
            en["circuits"] = {"value": ex["circuits"], "source": "wikidata", "basis": en["wikidata"]["basis"]}
        body = (ex.get("operator") or []) + (ex.get("owner") or [])
        if body:
            en["operator"] = {"value": body, "source": "wikidata", "basis": en["wikidata"]["basis"]}
    if k in photos:
        en["nearby_photo"] = photos[k]
    if k in searched:
        en["photo_search"] = {"radius_m": 150, "found": k in photos}
    if k in computed:
        e["computed"] = dict(computed[k])
    parts = [t.get("addr:housename"), t.get("addr:housenumber"), t.get("addr:street"), t.get("addr:suburb") or t.get("addr:neighbourhood"),
             t.get("addr:village") or t.get("addr:town") or t.get("addr:city")]
    if any(parts):
        addr = ", ".join(x for x in parts if x)
        tail = ", ".join(x for x in [e.get("district"), e.get("state")] if x)
        addr = addr + (", " + tail if tail else "") + (" – " + t["addr:postcode"] if t.get("addr:postcode") else "")
        e.setdefault("computed", {})["address"] = addr
    s = summaries.get(want.get(i)) if i in want else None
    if s and s.get("extract"):
        en["summary"] = {"text": s["extract"], "url": s["url"], "source": "Wikipedia (CC BY-SA 4.0)"}
    if en:
        e["enrich"] = en
    # completeness: which essentials do we hold, from any sourced/inferred basis?
    has = {
        "name": bool(t.get("name") or t.get("name:en") or en.get("name_en")),
        "district": bool(e.get("district") or t.get("addr:district")),
        "locality": bool(t.get("addr:city") or t.get("addr:town") or t.get("addr:village") or t.get("addr:suburb") or t.get("addr:street")),
        "deity": "deity" in en,
        "photo": bool(en.get("image_commons") or en.get("nearby_photo") or t.get("image") or t.get("wikimedia_commons")),
        "history": bool(en.get("summary") or en.get("founded")),
        "contact": bool(t.get("website") or t.get("phone") or t.get("contact:phone") or en.get("website")),
        "hours": bool(t.get("opening_hours")),
    }
    e["completeness"] = {"score": sum(has.values()), "of": len(has), "has": [k for k, v in has.items() if v]}
    for k, v in has.items():
        stats[k] += v
    if "deity" in en:
        stats["deity_" + en["deity"]["basis"]] += 1

n = len(elements)
print(f"\nmatched {len(matched)} OSM temples to Wikidata "
      f"(link={sum(1 for m in matched.values() if m[1] == 'wikidata_link')}, "
      f"spatial_name={sum(1 for m in matched.values() if m[1] == 'spatial_name')}, "
      f"spatial_close={sum(1 for m in matched.values() if m[1] == 'spatial_close')}); "
      f"{len(wd) - len(qid_taken)} Wikidata temples have no OSM counterpart")
for k in ("name", "district", "locality", "deity", "photo", "history", "contact", "hours"):
    print(f"  {k:<10}{stats[k]:>7}  {100 * stats[k] / n:5.1f}%")
for k in sorted(x for x in stats if x.startswith("deity_")):
    print(f"  {k:<28}{stats[k]:>7}")

# unmatched Wikidata temples (not in OSM) kept separately for review
um = [w for w in wd if w["qid"] not in qid_taken]
(root / "data").mkdir(exist_ok=True)
(root / "data" / "wikidata-only-temples.json").write_text(json.dumps({"source": "Wikidata (CC0)", "count": len(um), "items": um}, ensure_ascii=False))

(root / "india-temples.json").write_text(json.dumps({"version": 0.6, "generator": "enrich_temples.py", "osm3s": {"copyright": "© OpenStreetMap contributors, ODbL 1.0"}, "elements": elements}, ensure_ascii=False))
d = root / "data" / "states"
by = defaultdict(list)
for e in elements:
    by[e["state"]].append(e)
index = []
for name, els in sorted(by.items()):
    f = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") + ".json"
    (d / f).write_text(json.dumps({"state": name, "count": len(els), "copyright": "© OpenStreetMap contributors, ODbL 1.0", "elements": els}, indent=1, ensure_ascii=False))
    index.append({"state": name, "file": f, "count": len(els)})
(d / "index.json").write_text(json.dumps({"total": n, "states": index}, indent=1, ensure_ascii=False))
print("wrote enriched india-temples.json and data/states/*")

# dataset-info.json lets the browser check "is my copy current?" without downloading the 35 MB file
import hashlib
_b = (root / "india-temples.json").read_bytes()
(root / "data" / "dataset-info.json").write_text(json.dumps({"file": "india-temples.json", "version": hashlib.sha256(_b).hexdigest()[:12], "bytes": len(_b), "count": n, "generated": __import__("datetime").date.today().isoformat()}, indent=2))
print("wrote data/dataset-info.json")
