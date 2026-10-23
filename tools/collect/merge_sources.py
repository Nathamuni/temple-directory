#!/usr/bin/env python3
"""Merge the extra name sources into india-temples.json (idempotent: records of an earlier run are dropped first).

  python3 -I tools/collect/merge_sources.py [--dry]       (needs shapely; reads tools/cache/*.json, tools/cache/hrce/*.jsonl)

Inputs (each produced by its own script under tools/collect/):
  osm-extra.json          OSM temples the main extract skips (osm_extra.py)
  wikidata-names.json     Wikidata temple items with any-language names + state/district (wikidata_names.py)
  hrce/profiles-*.jsonl   Tamil Nadu HR&CE public profile pages: name, locality, district, PIN, deities (hrce_profiles.py)

What is added, and what is never done:
  * located records (OSM coordinates, or Wikidata coordinates inside an Indian state) join the map as before;
  * name-only records (no coordinate anywhere) carry "located": false. They are real, named temples with a state and usually a
    district, but NO coordinate is invented and no village centre is used;
  * a source record is dropped when it is clearly a temple we already hold (same Wikidata id; within 150 m; same name within 1 km;
    or, for name-only records, same district and the same name AND locality). Merely sharing a common deity name is never enough;
  * every added record has "batch" and its source link, so a later run can remove or refresh exactly these records.
"""
import json, math, pickle, re, sys, time, unicodedata, hashlib
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import shapely
from shapely import Point, STRtree

root = Path(__file__).resolve().parent.parent.parent
cache = root / "tools" / "cache"
BATCH = "2026-10-22"
DRY = "--dry" in sys.argv
T0 = time.time()
log = lambda m: print(f"[{time.time() - T0:5.0f}s] {m}", flush=True)

# ---- text helpers --------------------------------------------------------------------------------------
GENERIC = re.compile(r"\b(arulmigu|arulmighu|arulmiku|sri|shri|sree|swamy|swami|temple|temples|mandir|mandiram|kovil|koil|devasthanam|devalayam|devalaya|"
                     r"kshetram|kshetra|gudi|of|the|and|hindu|shrine|devi|vagaira|village|thirukkoil|thirukovil|tirukkoil|ayyan)\b", re.I)
TA_GENERIC = re.compile(r"(அருள்மிகு|அருள்மிகு|திருக்கோயில்|திருக்கோவில்|கோயில்|கோவில்|ஆலயம்|திருக்கோவிலூர்|ஸ்ரீ|ஸ்ரீ|சுவாமி|ஸ்வாமி)")


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").lower()
    s = "".join(c for c in s if not unicodedata.combining(c) or "஀" <= c <= "௿")
    s = TA_GENERIC.sub(" ", GENERIC.sub(" ", s))
    return re.sub(r"[^\w]+", " ", s).strip()


def sim(a, b):
    a, b = norm(a), norm(b)
    return 0.0 if not a or not b else 1.0 if a == b else SequenceMatcher(None, a, b).ratio()


def hav(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742000 * math.asin(math.sqrt(a))


NOT_A_TEMPLE = re.compile(r"auditorium|\bhall\b|school|college|vidyalaya|vidya mandir|museum|hospital|canteen|\bstage\b|office|library|hostel|"
                          r"kalyana|marriage|parking|toilet|bus stop|bus stand|\bshop\b|store|bank|\bpark\b|garden only", re.I)
BAD_AMENITY = {"school", "college", "university", "hospital", "clinic", "community_centre", "social_facility", "kindergarten", "library",
               "marketplace", "restaurant", "bus_station", "parking", "toilets", "bank", "townhall", "theatre", "events_venue"}
PRIORITY = ["en", "ta", "te", "kn", "ml", "hi", "mr", "bn", "gu", "or", "pa", "sa", "as", "ne", "ur"]
STRONG = re.compile(r"temple|mandir|mandhir|kovil|koil|devalay|devasthan|gudi\b|ammavaru|ammavari|ayyanar|கோவில்|கோயில்|ஆலயம்|मंदिर|దేవాలయం|ఆలయం|"
                    r"ದೇವಸ್ಥಾನ|ದೇವಾಲಯ|ക്ഷേത്രം|মন্দির|મંદિર|ମନ୍ଦିର", re.I)


def pos(e):
    return (e["lat"], e["lon"]) if "lat" in e else (e["center"]["lat"], e["center"]["lon"]) if "center" in e else (None, None)


# ---- base dataset ----------------------------------------------------------------------------------------
data = json.loads((root / "india-temples.json").read_text())
base = [e for e in data["elements"] if not e.get("batch")]  # idempotent: also drops any earlier batch
dropped_prev = len(data["elements"]) - len(base)
log(f"{len(base)} base records ({dropped_prev} from an earlier merge dropped)")

CELL = 0.01
grid = defaultdict(list)
have_q = set()
districts = defaultdict(set)  # state -> canonical district names already used by the dataset
by_dist_names = defaultdict(list)  # (state, district) -> [(normalised name, locality text, element)]
for e in base:
    la, lo = pos(e)
    t = e["tags"]
    if la is not None:
        grid[(int(la / CELL), int(lo / CELL))].append((la, lo, t))
    if t.get("wikidata"):
        have_q.add(t["wikidata"])
    if e["type"] == "wikidata":
        have_q.add("Q%d" % e["id"])
    if e.get("district"):
        districts[e["state"]].add(e["district"])
    nm = t.get("name:en") or t.get("name")
    if nm and e.get("district"):
        loc = " ".join(t.get(k, "") for k in ("addr:village", "addr:city", "addr:town", "addr:suburb", "addr:place", "name"))
        by_dist_names[(e["state"], e["district"])].append((norm(nm), norm(loc), e))


def canon_district(state, name):
    if not name:
        return None
    n = re.sub(r"\s+(district|zilla|jilla)$", "", name.strip(), flags=re.I)
    if n in districts[state]:
        return n
    best = max(districts[state], key=lambda d: SequenceMatcher(None, norm(d), norm(n)).ratio(), default=None)
    if best and SequenceMatcher(None, norm(best), norm(n)).ratio() >= 0.8:
        return best
    return n


def near_named(lat, lon, names, within=1000):
    near, dup = 9e9, False
    cx, cy = int(lat / CELL), int(lon / CELL)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for la, lo, t in grid.get((cx + dx, cy + dy), []):
                d = hav(lat, lon, la, lo)
                near = min(near, d)
                if d <= within and any(sim(n, t.get(k, "")) >= 0.6 for n in names for k in ("name", "name:en")):
                    dup = True
    return near, dup


# ---- boundaries (for coordinates that have no state yet) ------------------------------------------------
b = pickle.loads((cache / "boundaries.pkl").read_bytes())
sn, sp = b["states"][0], [shapely.from_wkb(x) for x in b["states"][1]]
stree = STRtree(sp)
dist = {l: (b[l][0], [shapely.from_wkb(x) for x in b[l][1]]) for l in ("5", "6")}
dtrees = {l: (STRtree(v[1]) if v[1] else None) for l, v in dist.items()}


def state_of(lat, lon):
    p = Point(lon, lat)
    for i in stree.query(p, predicate="intersects"):
        return sn[int(i)], "boundary"
    j = stree.nearest(p)
    if j is not None and sp[int(j)].distance(p) < 0.045:
        return sn[int(j)], "nearest_boundary_5km"
    return None, None


def district_of(lat, lon):
    p = Point(lon, lat)
    for lvl in ("5", "6"):
        t = dtrees[lvl]
        if t is None:
            continue
        hits = [int(i) for i in t.query(p, predicate="intersects")]
        if hits:
            i = min(hits, key=lambda i: dist[lvl][1][i].area)
            return dist[lvl][0][i], "boundary:admin_level=" + lvl
    return None, None


added, why = [], Counter()


def add(el, kind):
    el["batch"] = BATCH
    added.append(el)
    why["added " + kind] += 1


# ---- A. OSM extras -----------------------------------------------------------------------------------------
ex = cache / "osm-extra.json"
if ex.exists():
    for e in json.loads(ex.read_text())["elements"]:
        t = e["tags"]
        name = t.get("name:en") or t.get("name")
        if not name:
            why["OSM extra: unnamed"] += 1
            continue
        if NOT_A_TEMPLE.search(name) or t.get("amenity") in BAD_AMENITY or t.get("building") in ("school", "college", "hospital", "commercial", "retail"):
            why["OSM extra: not a temple (school, hall, office ...)"] += 1
            continue
        if e["extra_class"] == "hindu_other" and not (t.get("historic") in ("wayside_shrine", "ruins", "archaeological_site", "temple", "monument")
                                                       or "shrine" in t or STRONG.search(name)):
            why["OSM extra: religion=hindu but not clearly a temple (ashram, trust, centre)"] += 1
            continue
        la, lo = pos(e)
        near, dup = near_named(la, lo, [name, t.get("name", "")], within=300)
        if near < 40 or dup:
            why["OSM extra: matches a temple we already hold"] += 1
            continue
        e = dict(e)
        e["source_note"] = "OSM object without a religion tag" if e["extra_class"].startswith("untagged") else "OSM religion=hindu, other feature tag"
        add(e, "OSM extra")
        grid[(int(la / CELL), int(lo / CELL))].append((la, lo, t))
    log(f"OSM extras: {why['added OSM extra']} added")

# ---- A2. GeoNames temples (religion not stated by the source: keep only Hindu-looking names) ---------------------------------
HINDU_WORD = re.compile(r"temple|mandir|mandhir|mandira|kovil|koil|devalay|devasthan|gudi\b|amman|ammavaru|ayyanar|ayyappa|murugan|perumal|shiva|"
                        r"vishnu|hanuman|anjaneya|ganesh|ganapathi|vinayaga|pillayar|krishna|durga|mahadev|balaji|venkateswara|narasimha|lakshmi|"
                        r"eshwar|eswar|ishwar|nath\b|nathar|dev\b|devi\b|mata\b|shakti|kali\b|bhairav|jagannath|ram\b|sita|radha|"
                        r"kovvil|alayam|ksetra|kshetra|dham\b", re.I)
OTHER_FAITH = re.compile(r"church|chapel|mosque|masjid|dargah|dargha|gurudwara|gurdwara|buddh|vihar|jain|basadi|basti\b|derasar|monastery|gompa|"
                         r"cathedral|synagogue|pagoda|mazar|idgah|tirthankar|parsvanath|parshvanath|mahavir|adinath|neminath|shantinath", re.I)
gf = cache / "geonames-temples.json"
if gf.exists():
    for r in json.loads(gf.read_text())["rows"]:
        name = r["name"]
        txt = " ".join([name, r["ascii"]] + r["alt"])
        if OTHER_FAITH.search(txt):
            why["GeoNames: another faith's name"] += 1
            continue
        if not HINDU_WORD.search(name + " " + r["ascii"]):
            why["GeoNames: name does not read as a Hindu temple"] += 1
            continue
        st, sb = state_of(r["lat"], r["lon"])
        if not st:
            why["GeoNames: outside India's states"] += 1
            continue
        near, dup = near_named(r["lat"], r["lon"], [name, r["ascii"]], within=2000)
        if near < 150 or dup:
            why["GeoNames: matches a temple we already hold"] += 1
            continue
        d, db = district_of(r["lat"], r["lon"])
        el = {"type": "geonames", "id": r["id"], "lat": r["lat"], "lon": r["lon"], "tags": {"name": name, "religion": "hindu", "amenity": "place_of_worship"},
              "state": st, "state_basis": sb}
        if d:
            el["district"], el["district_basis"] = d, db
        add(el, "GeoNames")
        grid[(int(r["lat"] / CELL), int(r["lon"] / CELL))].append((r["lat"], r["lon"], el["tags"]))
    log(f"GeoNames: {why['added GeoNames']} added")

# ---- A3. Overture Maps places (hindu_place_of_worship; CDLA-Permissive-2.0) ---------------------------------------------------
of = cache / "overture-temples.json"
if of.exists():
    for r in json.loads(of.read_text())["rows"]:
        name = (r["name"] or "").strip()
        txt = " ".join([name] + list(r["common"].values()))
        if not name:
            why["Overture: unnamed"] += 1
            continue
        if OTHER_FAITH.search(txt) or NOT_A_TEMPLE.search(name):
            why["Overture: another faith or not a temple (hall, school, office ...)"] += 1
            continue
        if not (STRONG.search(txt) or HINDU_WORD.search(txt)):
            why["Overture: name does not read as a Hindu temple"] += 1
            continue
        if not norm(name):
            why["Overture: name is only a generic word (Temple, Mandir ...)"] += 1
            continue
        st, sb = state_of(r["lat"], r["lon"])
        if not st:
            why["Overture: outside India's states"] += 1
            continue
        names = [name] + [v for v in r["common"].values() if v]
        near, dup = near_named(r["lat"], r["lon"], names, within=500)
        if near < 60 or dup:
            why["Overture: matches a temple we already hold"] += 1
            continue
        tags = {"name": name, "religion": "hindu", "amenity": "place_of_worship", "ref:overture": r["id"]}
        if r.get("cat") and r["cat"] != "hindu_place_of_worship":
            tags["overture:category"] = r["cat"]
        for lg, v in r["common"].items():
            if lg in ("en", "ta", "te", "kn", "ml", "hi", "mr", "bn", "gu", "or", "pa") and v and v != name:
                tags["name:" + lg] = v
        for k, f in (("addr:city", "locality"), ("addr:postcode", "postcode"), ("addr:full", "addr")):
            if r.get(f):
                tags[k] = r[f]
        d, db = district_of(r["lat"], r["lon"])
        el = {"type": "overture", "id": int(r["id"].replace("-", "")[:12], 16), "lat": r["lat"], "lon": r["lon"], "tags": tags, "state": st, "state_basis": sb,
              "confidence": r["confidence"]}
        if d:
            el["district"], el["district_basis"] = d, db
        add(el, "Overture")
        grid[(int(r["lat"] / CELL), int(r["lon"] / CELL))].append((r["lat"], r["lon"], tags))
    log(f"Overture: {why['added Overture']} added")

# ---- B. Wikidata ------------------------------------------------------------------------------------------------
wf =cache / "wikidata-names.json"
if wf.exists():
    for qid, i in json.loads(wf.read_text())["items"].items():
        if qid in have_q:
            why["Wikidata: already linked"] += 1
            continue
        labels = [i["native"][l] for l in PRIORITY if l in i["native"]] + [v for l, v in i["native"].items() if l not in PRIORITY]
        if not labels:
            why["Wikidata: no label in any language"] += 1
            continue
        en = i["native"].get("en")
        nat = next((i["native"][l] for l in PRIORITY[1:] if l in i["native"]), None)
        tags = {"name": nat or en, "religion": "hindu", "amenity": "place_of_worship", "wikidata": qid}
        if en and nat:
            tags["name:en"] = en
        if i.get("wikipedia"):
            tags["wikipedia"] = "en:" + i["wikipedia"].rsplit("/", 1)[1].replace("_", " ")
        for lg, lab in i["native"].items():
            if lg not in ("en",) and lab != tags["name"]:
                tags["name:" + lg] = lab
        if i.get("deities"):
            tags["deity"] = ", ".join(i["deities"])
        el = {"type": "wikidata", "id": int(qid[1:]), "tags": tags}
        if i.get("lat") is not None:
            lat, lon = i["lat"], i["lon"]
            near, dup = near_named(lat, lon, labels)
            if near < 150 or dup:
                why["Wikidata: matches a mapped temple"] += 1
                continue
            st, sb = state_of(lat, lon)
            if not st:
                why["Wikidata: coordinate outside India's states"] += 1
                continue
            d, db = district_of(lat, lon)
            el.update(lat=lat, lon=lon, coord_source="wikidata", state=st, state_basis=sb)
            if d:
                el["district"], el["district_basis"] = d, db
            add(el, "Wikidata located")
            grid[(int(lat / CELL), int(lon / CELL))].append((lat, lon, tags))
        else:
            st = i.get("state")
            if not st:
                why["Wikidata: no coordinate and no state"] += 1
                continue
            d = canon_district(st, i.get("district"))
            if en and d:
                m = [x for x in by_dist_names[(st, d)] if x[0] == norm(en)]
                if m:
                    why["Wikidata: same name in same district as a mapped temple"] += 1
                    continue
            el.update(state=st, state_basis="wikidata_located_in", located=False)
            if d:
                el["district"], el["district_basis"] = d, "wikidata_located_in"
            add(el, "Wikidata name-only")
    log(f"Wikidata: {why['added Wikidata located']} located, {why['added Wikidata name-only']} name-only added")

# ---- C. HR&CE profiles --------------------------------------------------------------------------------------------
hrce = []
for f in sorted((cache / "hrce").glob("profiles-*.jsonl")) if (cache / "hrce").exists() else []:
    for line in f.read_text().splitlines():
        try:
            r = json.loads(line)
        except Exception:
            continue
        if r.get("code"):
            hrce.append(r)
if hrce:
    # Wikidata name-only Tamil Nadu records indexed by district for the HR&CE duplicate check
    wd_by_d = defaultdict(list)
    for e in added:
        if e["type"] == "wikidata" and e.get("located") is False and e["state"] == "Tamil Nadu":
            wd_by_d[e.get("district")].append(e)
    tn_taken = set()
    for r in sorted(hrce, key=lambda r: r["tid"]):
        parts = [p.strip() for p in r["en"].split(",")]
        name = parts[0]
        dm = re.search(r"([A-Za-z .'\-]+?)\s+District\s*$", r["en"])
        pin = re.search(r"-\s*(\d{6})", r["en"])
        d = canon_district("Tamil Nadu", dm.group(1) if dm else None)
        locality = parts[1] if len(parts) > 3 else ""
        town = re.sub(r"\s*-\s*\d{6}.*", "", parts[-2]) if len(parts) >= 3 else ""
        ta = r.get("ta") or ""
        ta_parts = [p.strip() for p in ta.split(",")]
        tags = {"name": ta_parts[0] if ta and re.search(r"[஀-௿]", ta_parts[0]) else name, "name:en": name,
                "religion": "hindu", "amenity": "place_of_worship", "operator": "HR&CE Department, Government of Tamil Nadu", "ref:hrce": r["code"]}
        if tags["name"] != name:
            tags["name:ta"] = tags["name"]
        if locality:
            tags["addr:suburb"] = locality
        if town:
            tags["addr:city"] = town
        if pin:
            tags["addr:postcode"] = pin.group(1)
        if d:
            tags["addr:district"] = d
        dd = [re.sub(r"^(arulmigu|arulmighu|arulmiku)\s+", "", x, flags=re.I) for x in dict.fromkeys(r.get("deities") or []) if x]
        dd = list(dict.fromkeys(dd))
        if dd:
            tags["deity"] = ", ".join(dd)
        # duplicate of a mapped temple: same district, same name, and the locality appears in the mapped record
        hit = None
        for nn, loc, e in by_dist_names.get(("Tamil Nadu", d), []):
            if SequenceMatcher(None, nn, norm(name)).ratio() >= 0.9 and norm(locality or town) and norm(locality or town).split()[0] in (loc + " " + nn):
                hit = e
                break
        if hit:
            hit.setdefault("tags", {}).setdefault("ref:hrce", r["code"])
            why["HR&CE: same temple as a mapped one (code linked to it)"] += 1
            continue
        # duplicate of a Wikidata name-only record: same district, village + deity tokens all present in Wikidata's label
        want = set(norm(" ".join([ta_parts[0] if ta else name] + ta_parts[1:2])).split())
        wmatch = None
        for e in wd_by_d.get(d, []):
            if id(e) in tn_taken:
                continue
            have = set(norm(e["tags"].get("name", "")).split())
            if want and len(want) >= 2 and want <= have:
                wmatch = e
                break
        if wmatch:
            tn_taken.add(id(wmatch))
            wmatch["tags"]["ref:hrce"] = r["code"]
            for k in ("addr:postcode", "addr:suburb", "addr:city", "deity", "name:en", "operator"):
                if k in tags and k not in wmatch["tags"]:
                    wmatch["tags"][k] = tags[k]
            why["HR&CE: same temple as a Wikidata record (merged into it)"] += 1
            continue
        add({"type": "hrce", "id": r["tid"], "tags": tags, "state": "Tamil Nadu", "state_basis": "hrce_profile", "district": d,
             "district_basis": "hrce_profile", "located": False}, "HR&CE name-only")
    log(f"HR&CE: {len(hrce)} profiles read, {why['added HR&CE name-only']} added")

# ---- write -----------------------------------------------------------------------------------------------------------
print()
for k, n in why.most_common():
    print(f"  {n:>7}  {k}")
total = len(base) + len(added)
print(f"\n  {len(base)} base + {len(added)} added = {total}; name-only: {sum(1 for e in added if e.get('located') is False)}")
print("  added by state:", Counter(e['state'] for e in added).most_common(10))
if DRY:
    sys.exit(0)
data["elements"] = base + added
text = json.dumps(data, ensure_ascii=False)
(root / "india-temples.json").write_text(text)
raw = text.encode()
(root / "data" / "dataset-info.json").write_text(json.dumps({"file": "india-temples.json", "version": hashlib.sha256(raw).hexdigest()[:12], "bytes": len(raw),
                                                             "count": total, "generated": time.strftime("%Y-%m-%d")}, indent=2))
log(f"wrote india-temples.json ({len(raw) / 1e6:.1f} MB) and data/dataset-info.json")
