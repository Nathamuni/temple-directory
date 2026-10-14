#!/usr/bin/env python3
"""Managing body and pilgrim circuits for temples matched to Wikidata -> tools/cache/wikidata-extra.json (stdlib only)."""
import json, re, time, urllib.parse, urllib.request
from pathlib import Path
root = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)"}
els = json.loads((root / "india-temples.json").read_text())["elements"]
qids = sorted({e["enrich"]["wikidata"]["qid"] for e in els if e.get("enrich", {}).get("wikidata", {}).get("basis") in ("wikidata_link", "spatial_name")})
print(len(qids), "matched Wikidata items", flush=True)

def api(ids, props):
    url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(ids), "props": props, "languages": "en", "format": "json"})
    for i in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40)).get("entities", {})
        except Exception:
            time.sleep(3 * (i + 1))
    return {}

def claim_ids(ent, prop):
    return [c["mainsnak"]["datavalue"]["value"]["id"] for c in ent.get("claims", {}).get(prop, []) if c.get("mainsnak", {}).get("datavalue")]

raw, targets = {}, set()
for i in range(0, len(qids), 50):
    for q, ent in api(qids[i:i + 50], "claims").items():
        raw[q] = {"circuits": claim_ids(ent, "P361"), "operator": claim_ids(ent, "P137"), "owner": claim_ids(ent, "P127")}
        targets.update(raw[q]["circuits"] + raw[q]["operator"] + raw[q]["owner"])
    time.sleep(0.5)
labels, tl = {}, sorted(targets)
for i in range(0, len(tl), 50):
    for q, ent in api(tl[i:i + 50], "labels").items():
        labels[q] = ent.get("labels", {}).get("en", {}).get("value")
    time.sleep(0.5)
out = {q: {k: [labels[x] for x in v if labels.get(x)] for k, v in d.items()} for q, d in raw.items()}
out = {q: d for q, d in out.items() if any(d.values())}
(root / "tools" / "cache" / "wikidata-extra.json").write_text(json.dumps(out, ensure_ascii=False))
print(f"{len(out)} items have a circuit, operator or owner;", sum(1 for d in out.values() if d["circuits"]), "circuits,", sum(1 for d in out.values() if d["operator"] or d["owner"]), "managing bodies")
print(sorted({c for d in out.values() for c in d["circuits"]})[:12])
