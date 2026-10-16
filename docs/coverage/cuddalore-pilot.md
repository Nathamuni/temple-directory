# Provisional Cuddalore pilot — partial source coverage

**This is not a complete temple inventory.** The place list is provisional (OpenStreetMap, no LGD codes), discovery used OSM, Wikidata and
Wikipedia (English + Tamil) only, and no web-search pass (pass C) was run. "Searched" means a source was queried, not that a place has no more temples.

## Temples
| Group | Count | Meaning |
|---|---|---|
| Existing records (pass A) | 265 | already in the directory from OSM / Wikidata; 166 have a name |
| Newly discovered (pass B) | 106 | from Wikipedia (mostly Tamil village-temple articles) and cuddalore.nic.in temple pages; not yet reviewed |
| Enriched existing records | 17 | existing records that gained Wikipedia evidence |
| Duplicates merged | 23 | Wikipedia hits matched to an existing record (Wikidata id, or name + distance) and added as evidence instead of a new record |
| **Total candidates** | 371 | all state `candidate`; none reviewed or corroborated yet |

## Places
| Type | Provisional places |
|---|---|
| hamlet | 20 |
| revenue_village | 79 |
| taluk | 10 |
| urban_body | 15 |
| ward | 52 |

Units with a Tamil name searched in Tamil too; **40** places have no Tamil name, so only English queries ran for them.

| Unit status | Count |
|---|---|
| SEARCH_COMPLETE_WITH_FINDINGS | 104 |
| IN_PROGRESS | 72 |

`IN_PROGRESS` (72) = nothing found yet and the second pass has not run.

## Tasks
| Pass | Status | Jobs |
|---|---|---|
| A | done | 176 |
| B | done | 299 |

Pass C (aliases, deity words, gap searches) is **blocked**: it needs a licensed web-search API. Blocked sources: LGD downloads (CAPTCHA), HR&CE search (CAPTCHA).

## Unresolved gaps
| Review reason | Records |
|---|---|
| location_unresolved | 156 |
| other | 128 |

- Candidates with no place assigned: **58**; with no coordinates: **98** (Wikipedia articles without a map point; their place is a text match only).
- The 166 provisional places are far fewer than the district's real villages, so places missing from the list were never searched.

## Spot check
9 randomly chosen new Tamil Wikipedia temples were read against their own text: all 9 state they are in Cuddalore district. Their **place** is the
nearest provisional place or the searched place, so it can differ from the village the article names (for example a village missing from the
provisional list). Treat place on text-only records as approximate. Only 9 were checked.

## Fields with evidence (candidates holding each)
| Field | Candidates |
|---|---|
| temple_name | 143 |
| temple_name_ta | 112 |
| darshan_timings | 5 |
| official_website | 1 |

Everything else is empty (`NULL`): timings, history, festivals, facilities, contacts for most temples.

## By taluk (provisional)
| Taluk | Existing | New | Places |
|---|---|---|---|
| Cuddalore | 60 | 24 | 63 |
| Panruti | 55 | 22 | 41 |
| Bhuvanagiri | 20 | 16 | 14 |
| Chidambaram | 18 | 16 | 12 |
| Kattumannarkoil | 15 | 8 | 15 |
| Virudhachalam | 12 | 5 | 4 |
| Kurinjipadi | 10 | 8 | 7 |
| Srimushnam | 6 | 1 | 2 |
| Veppur | 6 | 0 | 1 |
| Tittakudi | 5 | 6 | 7 |

