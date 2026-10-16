#!/usr/bin/env python3
"""Add temple pages from a district government site (cuddalore.nic.in) as evidence. Run AFTER build_pilot.py (which resets the tables).
  tools/.venv/bin/python -I tools/collect/district_site.py Cuddalore
robots.txt: none published (HTTP 204). Pages are cached under tools/cache/collect. The pages largely repeat Wikipedia text, so their
evidence is grouped as 'district-site-copy' and is NOT counted as independent corroboration."""
import hashlib, html, os, re, subprocess, sys, urllib.request
from pathlib import Path
root = Path(__file__).resolve().parent.parent.parent
DB = os.environ.get("DATABASE_URL", "postgres://postgres:temple@localhost:5440/temple_directory")
UA = "TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)"
BASE = "https://cuddalore.nic.in"
cdir = root / "tools/cache/collect"
q = lambda v: "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"
GENERIC = {"temple", "kovil", "koil", "sri", "shri", "swamy", "swami", "amman", "mandir"}
import difflib
_strip = lambda w: re.sub(r"swamy|swami|swamigal|koil|kovil|temple", "", w)
toks = lambda s: {_strip(w) for w in re.findall(r"[a-z]{5,}", (s or "").lower()) if w not in GENERIC and len(_strip(w)) >= 5}
# spelling variants (Devanathaswamy / Devanadha, Viruthagerreswarar / Virudhagiriswarar) count as the same distinctive word at >= 0.8 similarity
close = lambda a, b: any(difflib.SequenceMatcher(None, x, y).ratio() >= 0.8 for x in a for y in b)


def get(url):
    f = cdir / ("nic-" + hashlib.sha1(url.encode()).hexdigest()[:16] + ".html")
    if f.exists(): return f.read_text(errors="ignore")
    s = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read().decode("utf8", "ignore")
    f.write_text(s); return s


def psql(sql, fetch=False):
    r = subprocess.run(["psql", DB, "-v", "ON_ERROR_STOP=1", "-tAF", "\t", "-c", sql], capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr)
    return [l.split("\t") for l in r.stdout.rstrip("\n").split("\n") if l] if fetch else None


index = get(BASE + "/tourist-places/")
slugs = sorted({m for m in re.findall(r'href="https?://cuddalore\.nic\.in/tourist-place/([^"#?/]+)/"', index) if re.search(r"temple|kovil|koil", m)})
cands = [(int(r[0]), r[1] if len(r) > 1 else '') for r in psql("select id, coalesce(name_en,'') from temple_candidates", True)]
psql("delete from field_evidence where independent_group='district-site-copy'; delete from temple_candidates where id in (select candidate_id from candidate_external_ids where scheme='other' and value like 'district-site:%')")
added = linked = 0
for slug in slugs:
    url = f"{BASE}/tourist-place/{slug}/"
    page = get(url)
    body = re.sub(r"<(script|style|nav|header|footer)[^>]*>.*?</\1>", "", page, flags=re.S)
    text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body)))
    name = html.unescape(re.sub(r"\s+", " ", (re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S) or re.search(r"<title>(.*?)[|<]", page, re.S)).group(1))).strip()
    i = text.find("See More Photos"); passage = text[i + 15:i + 15 + 350].strip() if i >= 0 else text[:350]
    psql(f"insert into sources(url,publisher,licence) values({q(url)},'Cuddalore District Administration (cuddalore.nic.in)',NULL) on conflict(url) do nothing")
    sid = psql(f"select id from sources where url={q(url)}", True)[0][0]
    nt = toks(name)
    match = next((cid for cid, n in cands if nt and close(nt, toks(n))), None)
    if match: linked += 1
    else:
        cid = psql("select nextval('temple_candidates_id_seq')", True)[0][0]
        psql(f"insert into temple_candidates(id,name_en,status) values({cid},{q(name)},'candidate'); insert into candidate_external_ids(candidate_id,scheme,value) values({cid},'other',{q('district-site:' + slug)}); insert into review_queue(candidate_id,reason,detail) values({cid},'location_unresolved','district page names no mappable place; may duplicate an existing record under another spelling')")
        match = int(cid); added += 1
        cands.append((match, name))
    psql(f"insert into field_evidence(candidate_id,field_key,value,source_id,passage,independent_group) values({match},'temple_name',{q(name)},{sid},{q(passage)},'district-site-copy')")
print(f"temple pages {len(slugs)}: linked to existing {linked}, new candidates {added}")
