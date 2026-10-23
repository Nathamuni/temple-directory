#!/usr/bin/env python3
"""Collect temple names from the Tamil Nadu HR&CE public temple profile pages (index_temple.php?tid=N).

  python3 -I tools/collect/hrce_profiles.py [first_tid] [last_tid]      (stdlib only; resumable)

Allowed by docs/COLLECTION.md ("its public profile pages"); the CAPTCHA search page is NOT used. Each page is ~470 KB of boilerplate, so
the response is read only until the title and Tamil heading have appeared, then the connection is closed. One request at a time, a pause
between requests, a descriptive User-Agent, every result cached in tools/cache/hrce/profiles-<first>-<last>.jsonl (re-running skips finished ids).

Stored per profile (facts only, no page text): tid, code [TMnnnnnn], English title, Tamil title, deity names from the title line.
"""
import json, re, sys, time, html, urllib.request
from pathlib import Path

cache = Path(__file__).resolve().parent.parent / "cache" / "hrce"
cache.mkdir(parents=True, exist_ok=True)
UA = "TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory; public-name collection, 1 request at a time)"
PAUSE = 0.6
first = int(sys.argv[1]) if len(sys.argv) > 1 else 1
last = int(sys.argv[2]) if len(sys.argv) > 2 else 48000

out = cache / f"profiles-{first}-{last}.jsonl"
done = set()
for f in cache.glob("profiles-*.jsonl"):  # every worker's file, so a re-run with other ranges still skips finished ids
    for line in f.read_text().splitlines():
        try:
            done.add(json.loads(line)["tid"])
        except Exception:
            pass

TITLE = re.compile(r"<title>(.*?)</title>", re.S)
TA = re.compile(r'id="spn_temple"[^>]*>\s*([^<]+?)\s*<label')  # Tamil heading: name, locality, town - PIN, district (the word "district" is the label)


def fetch(tid):
    req = urllib.request.Request(f"https://hrce.tn.gov.in/hrcehome/index_temple.php?tid={tid}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        buf = b""
        while len(buf) < 120000:
            chunk = r.read(8192)
            if not chunk:
                break
            buf += chunk
            txt = buf.decode("utf-8", "ignore")
            if "</title>" in txt and TA.search(txt):
                break
            if "404 Page Not Found" in txt:
                break
        return buf.decode("utf-8", "ignore")


def parse(tid, page):
    if "404 Page Not Found" in page[:3000]:
        return {"tid": tid, "missing": True}
    t = TITLE.search(page)
    m = re.match(r"\s*(.*?)\s*\[(TM\d+)\]\.?,?(.*)", html.unescape(t.group(1)), re.S) if t else None
    if not m:
        return {"tid": tid, "unparsed": True}
    deities = [d.strip(" .") for d in m.group(3).split(",") if d.strip(" .")]
    ta = TA.search(page)
    return {"tid": tid, "code": m.group(2), "en": re.sub(r"\s+", " ", m.group(1)), "ta": re.sub(r"\s+", " ", html.unescape(ta.group(1))).strip(" .,") if ta else None, "deities": deities}


n = ok = 0
with out.open("a") as fh:
    for tid in range(first, last + 1):
        if tid in done:
            continue
        for attempt in range(4):
            try:
                rec = parse(tid, fetch(tid))
                break
            except Exception as e:
                time.sleep(5 * (attempt + 1))
                rec = None
        if rec is None:
            print(f"tid {tid}: failed after retries; stopping so a re-run resumes here", flush=True)
            sys.exit(1)
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        fh.flush()
        n += 1
        ok += 1 if rec.get("code") else 0
        if n % 200 == 0:
            print(f"tid {tid}: {n} fetched, {ok} profiles", flush=True)
        time.sleep(PAUSE)
print(f"done {n} fetched, {ok} profiles")
