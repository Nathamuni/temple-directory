#!/usr/bin/env python3
"""Fetch every temple-like Wikidata item in India, with a name in any Indian language and its state/district.

  python3 -I tools/collect/wikidata_names.py            (stdlib only; resumable)

Writes tools/cache/wikidata-names.json: {qid: {native:{lang:label}, state, district, lat, lon, classes, deities, wikipedia, located}}.
Unlike fetch_wikidata_temples.py this keeps Tamil/Telugu/Hindi/... labels (an item with no English label still has a name),
and it resolves the state by walking the located-in (P131) chain client-side, which is cheap; the server-side P131* query
used for that times out on Wikidata's public endpoint.
Classes: Hindu temple (Q842402) and subclasses; temple (Q44539) whose religion is Hinduism (P140).
"""
import json, sys, time, urllib.parse, urllib.request
from pathlib import Path

out = Path(__file__).resolve().parent.parent / "cache" / "wikidata-names.json"
UA = "TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)"
LANGS = ["en", "ta", "te", "kn", "ml", "hi", "mr", "bn", "gu", "or", "pa", "sa", "as", "ne", "ur"]
CLASSES = {
    "hindu_temple": "?t wdt:P31/wdt:P279* wd:Q842402 .",
    "temple_hindu": "?t wdt:P31/wdt:P279* wd:Q44539 . ?t wdt:P140/wdt:P279* wd:Q9089 .",
}
PAGE = 1500


def sparql(q, tries=6):
    for i in range(tries):
        try:
            req = urllib.request.Request("https://query.wikidata.org/sparql", urllib.parse.urlencode({"query": q}).encode(),
                                         {"User-Agent": UA, "Accept": "application/sparql-results+json"})
            return json.load(urllib.request.urlopen(req, timeout=170))["results"]["bindings"]
        except Exception as e:
            print(f"  retry {i + 1}: {e}", flush=True)
            time.sleep(10 * (i + 1))
    raise SystemExit("Wikidata kept failing; re-run later (progress is saved)")


v = lambda b, k: b[k]["value"] if k in b else None
q_of = lambda b, k: v(b, k).rsplit("/", 1)[1] if v(b, k) else None
state = json.loads(out.read_text()) if out.exists() else {"done": [], "items": {}, "places": {}}
save = lambda: out.write_text(json.dumps(state, ensure_ascii=False))

# ---- 1. items, one class at a time, paged ----------------------------------------------------------
for cname, cl in CLASSES.items():
    offset = state.get("offset:" + cname, 0)
    while cname not in state["done"]:
        q = f"""
SELECT ?t ?coord ?wp
  (GROUP_CONCAT(DISTINCT CONCAT(LANG(?lab), "~", STR(?lab)); separator="|") AS ?labels)
  (GROUP_CONCAT(DISTINCT STR(?loc); separator="|") AS ?located)
  (GROUP_CONCAT(DISTINCT ?deityL; separator="|") AS ?deities)
WHERE {{
  {{ SELECT DISTINCT ?t WHERE {{ {cl} ?t wdt:P17 wd:Q668 . }} ORDER BY ?t LIMIT {PAGE} OFFSET {offset} }}
  OPTIONAL {{ ?t rdfs:label ?lab FILTER(lang(?lab) IN ({",".join('"%s"' % l for l in LANGS)})) }}
  OPTIONAL {{ ?t wdt:P625 ?coord }}
  OPTIONAL {{ ?wp schema:about ?t; schema:isPartOf <https://en.wikipedia.org/> }}
  OPTIONAL {{ ?t wdt:P131 ?loc }}
  OPTIONAL {{ ?t wdt:P825 ?dd . ?dd rdfs:label ?deityL FILTER(lang(?deityL)="en") }}
}} GROUP BY ?t ?coord ?wp"""
        rows = sparql(q)
        ids = {q_of(b, "t") for b in rows}
        for b in rows:
            qid = q_of(b, "t")
            it = state["items"].setdefault(qid, {"classes": [], "native": {}, "located": []})
            if cname not in it["classes"]:
                it["classes"].append(cname)
            for pair in (v(b, "labels") or "").split("|"):
                if "~" in pair:
                    lg, lab = pair.split("~", 1)
                    if lab and not (lab[0] == "Q" and lab[1:].isdigit()):
                        it["native"][lg] = lab
            c = v(b, "coord")
            if c and c.startswith("Point(") and it.get("lat") is None:
                lon, lat = c[6:-1].split()
                it["lat"], it["lon"] = float(lat), float(lon)
            for l in (v(b, "located") or "").split("|"):
                if l and l.rsplit("/", 1)[1] not in it["located"]:
                    it["located"].append(l.rsplit("/", 1)[1])
            if v(b, "wp"):
                it["wikipedia"] = v(b, "wp")
            if v(b, "deities"):
                it["deities"] = sorted(set(it.get("deities", []) + v(b, "deities").split("|")))
        offset += PAGE
        state["offset:" + cname] = offset
        if len(ids) < PAGE:
            state["done"].append(cname)
        save()
        print(f"{cname}: offset {offset}, {len(state['items'])} items", flush=True)

# ---- 2. resolve state / district by walking P131 -------------------------------------------------------
st_rows = sparql('SELECT ?s ?l WHERE { { ?s wdt:P31 wd:Q12443800 } UNION { ?s wdt:P31 wd:Q467745 } '
                 '?s rdfs:label ?l FILTER(lang(?l)="en") FILTER NOT EXISTS { ?s wdt:P576 ?gone } }')
STATES = {q_of(b, "s"): v(b, "l") for b in st_rows}
print(len(STATES), "current states/UTs", flush=True)
places = state["places"]  # qid -> {label, parents:[qid], district:bool}
for round_ in range(7):
    want = {l for it in state["items"].values() for l in it["located"]} | {p for pl in places.values() for p in pl["parents"]}
    need = sorted(n for n in want if n not in places and n not in STATES)
    if not need:
        break
    print(f"round {round_}: resolving {len(need)} places", flush=True)
    for i in range(0, len(need), 300):
        chunk = need[i:i + 300]
        rows = sparql("""SELECT ?p ?l (GROUP_CONCAT(DISTINCT STR(?par); separator="|") AS ?parents) (COUNT(?dist) AS ?isdist) WHERE {
  VALUES ?p { %s }
  OPTIONAL { ?p rdfs:label ?l FILTER(lang(?l)="en") }
  OPTIONAL { ?p wdt:P131 ?par }
  OPTIONAL { ?p wdt:P31 ?dist FILTER(?dist = wd:Q1149652) }
} GROUP BY ?p ?l""" % " ".join("wd:" + c for c in chunk))
        for b in rows:
            places[q_of(b, "p")] = {"label": v(b, "l"), "parents": [x.rsplit("/", 1)[1] for x in (v(b, "parents") or "").split("|") if x],
                                    "district": int(v(b, "isdist") or 0) > 0}
        for c in chunk:
            places.setdefault(c, {"label": None, "parents": [], "district": False})
        save()


def walk(q, depth=0):
    """-> (state qid, district label) reachable from place q"""
    if q in STATES:
        return q, None
    if depth > 8 or q not in places:
        return None, None
    pl = places[q]
    for p in pl["parents"]:
        s, d = walk(p, depth + 1)
        if s:
            return s, d or (pl["label"] if pl["district"] else None)
    return None, None


resolved = 0
for qid, it in state["items"].items():
    for l in it["located"]:
        s, d = walk(l)
        if s:
            it["state"], it["district"] = STATES[s], d
            resolved += 1
            break
    it["located_labels"] = [places[l]["label"] for l in it["located"] if places.get(l, {}).get("label")][:3]
save()
named = sum(1 for it in state["items"].values() if it["native"])
print(f"{len(state['items'])} items; {resolved} with a state; {named} with a name; {sum(1 for it in state['items'].values() if it.get('lat') is not None)} with coordinates")
