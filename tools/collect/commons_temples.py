#!/usr/bin/env python3
"""Walk Wikimedia Commons' Hindu-temple category tree for India and keep the category names that name one temple.

  python3 -I tools/collect/commons_temples.py            (stdlib only; resumable: the category cache is rewritten as it grows)

Start: "Hindu temples in India by state or territory". Each state category is followed down through its district/city/town
sub-categories. A category such as "Kapaleeshwarar Temple, Mylapore" is a candidate temple; "Interior of ..." or "... by deity" is not.
Writes tools/cache/commons-temples.json {state: {category title: [path of parent category titles]}}.
Category names are plain facts about what exists; no image or text is copied.
"""
import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

out = Path(__file__).resolve().parent.parent / "cache" / "commons-temples.json"
UA = "TempleDirectoryImporter/1.0 (+https://github.com/Nathamuni/temple-directory)"
ROOT = "Category:Hindu temples in India by state or territory"
SKIP = re.compile(r"\bby (deity|date|century|year|type|style|architect|religion|photographer)\b|"
                  r"interior|exterior|festival|statue|sculpture|bell|chariot|vimana|shikhara|gopura|gopuram|inscription|painting|relief|"
                  r"mural|ruins of|maps? of|plans? of|historical images|images? of|panoramas|views? (of|from)|events|by month|"
                  r"people|priests?|devotees|rituals?|ceremon|food|prasad|architecture|mythology|deities in|idols?|lamp|flag|"
                  r"unidentified|unknown|uploaded|files|stubs|redirect|wikidata|by photographer|\d{4}", re.I)
TEMPLE = re.compile(r"temple|mandir|mandiram|kovil|koil|devasthan|devalay|ashram|math\b|gudi|kshetra|devi\b|shrine|peetham|pitham|"
                    r"jagannath|balaji|venkateswara|murugan|ayyappa|narasimha", re.I)
MAXCAT = 40000


def api(**p):
    p["format"] = "json"
    for i in range(5):
        try:
            u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)
            return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60))
        except Exception as e:
            time.sleep(5 * (i + 1))
    raise SystemExit("Commons kept failing; re-run later")


def subcats(title):
    res, cont = [], {}
    while True:
        r = api(action="query", list="categorymembers", cmtitle=title, cmtype="subcat", cmlimit=500, **cont)
        res += [m["title"] for m in r["query"]["categorymembers"]]
        if "continue" not in r:
            return res
        cont = {"cmcontinue": r["continue"]["cmcontinue"]}


state = json.loads(out.read_text()) if out.exists() else {"visited": {}, "found": {}}
visited, found = state["visited"], state["found"]  # visited: title -> [children]
states = [c for c in (subcats(ROOT) if ROOT not in visited else visited[ROOT]) if c.startswith("Category:Hindu temples in ")]
visited[ROOT] = states
print(len(states), "state categories", flush=True)


expanded = set()  # category graphs have cycles; expand each category once


def walk(state_title, title, path):
    if len(visited) > MAXCAT or title in expanded:
        return
    expanded.add(title)
    kids = visited.get(title)
    if kids is None:
        kids = subcats(title)
        visited[title] = kids
        time.sleep(0.15)
        if len(visited) % 200 == 0:
            out.write_text(json.dumps(state, ensure_ascii=False))
            print(f"  {len(visited)} categories visited, {len(found)} candidates", flush=True)
    for k in kids:
        name = k.replace("Category:", "")
        if SKIP.search(name):
            continue
        # a category "X in <place>" or "... in <place>" lists things in a place, so it is a container; keep walking
        if re.search(r"^(Hindu )?temples? (in|of|at|near)\b|\bin [A-Z]", name) and not re.search(r"^(Sri|Shri|Arulmigu)\b", name):
            walk(state_title, k, path + [name])
            continue
        if TEMPLE.search(name):
            found.setdefault(state_title, {})[name] = path
            walk(state_title, k, path + [name])  # a temple category can hold sub-temples (complex shrines); bounded by MAXCAT
        else:
            walk(state_title, k, path + [name])


for st in states:
    print("==", st, flush=True)
    walk(st, st, [st.replace("Category:", "")])
    out.write_text(json.dumps(state, ensure_ascii=False))
out.write_text(json.dumps(state, ensure_ascii=False))
print("done:", len(visited), "categories visited;", sum(len(v) for v in found.values()), "temple-like categories")
