# Temple enrichment brief

You are researching real temples for a **sourced** directory. The product rule that
governs everything below:

> A claim becomes public only because a source says so — never because it sounds right.

Fabricating a fact, a timing, or a citation is the one unrecoverable failure here. An
empty field is fine. An invented one poisons the directory.

## Hard rules

1. **Only cite a URL you actually opened with WebFetch.** Not a URL from a search
   result snippet you did not open. Not a URL you believe exists. If WebFetch fails,
   the source does not go in the file.
2. **Never invent** a timing, phone number, date, PIN code, coordinate, licence,
   photographer, or source. If you cannot source it, leave the field out entirely.
3. **Do not write worship SOP steps** unless an official or temple-authority source
   actually describes the practice at *that* temple. Generic Hindu worship guidance is
   exactly what must not be here. Leave `worshipSop` as `[]` in almost every case.
   Never write a pradakshina count, shrine visiting order, or mantra unless a temple
   authority documents it.
4. **Never state a disputed or changing fact as settled.** Temple timings change. If
   sources disagree, record what each says in `notes` and set
   `verificationStatus: "conflict"`.
5. **Do not touch `data/temples/`.** Write only your patch file. The main thread merges.

## Source priority

| `sourceType` | Use for | Examples |
|---|---|---|
| `government` | timings, administration, access, protection status | `hrce.tn.gov.in`, `asi.nic.in`, `*.nic.in` district sites, state tourism `*.gov.in` |
| `official temple` | poojas, sevas, festivals, contact | devasthanam / temple trust sites |
| `academic` | history, inscriptions, architecture | journals, conference proceedings, museum PDFs |
| `media repository` | images only | Wikimedia Commons |
| `other` | enrichment only, never the sole basis for a timing | Wikipedia, reputable references |

**Tamil Nadu tip:** HR&CE publishes a page per temple at
`https://hrce.tn.gov.in/hrcehome/index_temple.php?tid=<id>` and a pooja schedule at the
same URL with `&action=pooja_info`. Search `hrce.tn.gov.in <temple name>` to find the id.
This is the best government source for TN timings, poojas and administration.

## `verificationStatus` — set it honestly

- `verified` — a government or official temple source states it directly
- `cross-referenced` — two independent sources agree
- `sourced` — one non-official source states it
- `conflict` — sources disagree (record both in `notes`)
- `needs recheck` — operational detail that may have changed since publication
- `unverified` — you are recording it but nothing backs it

Operational data (hours, poojas) should almost never be `verified` unless it came from
the temple's own or the government's own current page. Prefer `needs recheck`.

## Output

Write exactly one file per temple: `research/enrichment/<slug>.json`

Include **only** fields you actually sourced. Omit everything else — do not emit empty
strings or placeholder objects. `sourceIds` in every record must reference a `sourceId`
you defined in `sources` in the same file (use local ids `SRC001`, `SRC002`, …; the
merge step renumbers them).

```jsonc
{
  "slug": "<slug>",

  "sources": [
    {
      "sourceId": "SRC001",
      "sourceType": "government",
      "title": "Exact page title",
      "publisherOrAuthority": "Who publishes it",
      "author": "",                       // omit if none
      "url": "https://... (one you opened)",
      "publicationDate": "",              // omit unless stated
      "accessDate": "2026-09-17",
      "claimScope": "Precisely which claims in this file this source supports.",
      "reliabilityNote": "Limitations, e.g. page undated; timings may be stale.",
      "adminApproved": false
    }
  ],

  "identity": {
    "spiritualSignificanceShort": "2-3 sentences on why devotees revere THIS temple.",
    "sacredClassifications": ["Jyotirlinga", "Pancha Bhuta Sthalam — ..."],
    "tradition": "Shaiva",                // one of the schema's lookups
    "templeType": "...",
    "consortDeity": "",
    "nameLocal": "",
    "localLanguage": "Tamil"
  },

  "location": {
    "district": "", "postalCode": "", "latitude": 0, "longitude": 0
  },

  "governance": {
    "establishedEra": "Avoid false precision — 'c. 11th century' not '1010 CE' unless sourced.",
    "founderPatron": "", "managingAuthority": "",
    "administrationType": "Government department",
    "officialWebsite": "", "officialPhone": "", "officialEmail": ""
  },

  "narrative": {
    "documentedHistory": "What sources actually document. Multiple paragraphs, \\n\\n separated.",
    "sthalaPuranam": "Traditional account — only if a temple/scriptural source gives it.",
    "architectureStyle": "", "sacredTree": "", "sacredTank": "",
    "associatedSaints": ["..."], "inscriptionsSummary": ""
  },

  "visitingInfo": {
    "dressCode": "", "entryRules": "", "photographyPolicy": "",
    "accessibilityNotes": "", "prasadInfo": "",
    "nearestRailStation": "", "railDistanceKm": 0,
    "nearestBusStation": "", "busDistanceKm": 0,
    "nearestAirport": "", "airportDistanceKm": 0,
    "officialContactNote": "How a visitor should confirm same-day details.",
    "sourceIds": ["SRC001"],
    "lastVerifiedDate": "2026-09-17",
    "verificationStatus": "needs recheck"
  },

  "openingHours": [
    { "hoursId": "HRS001", "dayType": "daily", "sessionName": "Morning",
      "openTime": "06:00", "closeTime": "12:00", "closedFlag": false,
      "notes": "", "sourceIds": ["SRC001"],
      "lastVerifiedDate": "2026-09-17", "verificationStatus": "needs recheck" }
  ],

  "poojas": [
    { "poojaId": "PUJ001", "recordType": "pooja", "nameEn": "Kalasandhi Pooja",
      "nameLocal": "", "startTime": "07:45", "endTime": "09:00",
      "recurrence": "Daily", "description": "",
      "linkedMediaIds": [], "sourceIds": ["SRC001"],
      "lastVerifiedDate": "2026-09-17", "verificationStatus": "needs recheck" }
  ],

  "festivals": [
    { "festivalId": "FES001", "festivalNameEn": "...", "festivalNameLocal": "",
      "tamilOrLocalMonth": "", "gregorianRuleOrDate": "", "duration": "",
      "significance": "Why it matters at THIS temple.",
      "processionOrRituals": "", "crowdNote": "", "visitorAdvice": "",
      "linkedMediaIds": [], "sourceIds": ["SRC001"],
      "verificationStatus": "sourced" }
  ],

  "shrines": [
    { "shrineId": "SHR001", "shrineName": "...", "deityOrSubject": "",
      "localName": "", "spaceType": "shrine",
      "locationDescription": "Where it sits in the complex.",
      "linkedMediaIds": [], "sourceIds": ["SRC001"],
      "verificationStatus": "sourced" }
  ],
  // spaceType: shrine | sabha | tank | sacred tree | gopuram | hall | prakaram | other
  // Do NOT set sequenceNumber or pradakshinaCount unless a temple authority documents the order.

  "media": [
    { "mediaId": "MED001", "mediaType": "image", "category": "gopuram",
      "title": "", "caption": "What it shows.", "altText": "Accessibility text.",
      "fileOrUrl": "https://upload.wikimedia.org/...",
      "creator": "Exact author from the Commons page",
      "license": "CC BY-SA 4.0",
      "attributionText": "Creator · Licence",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:..." }
  ]
  // category: hero | exterior | gopuram | tank | shrine | architecture | festival | signage | map | other
  // Only Wikimedia Commons or explicitly free-licensed images. Open the Commons
  // File: page and copy the real author and licence. Never guess a licence.
  // Do not add a "hero" image — every temple already has one.
}
```

## Method per temple

1. `WebSearch` for official and government pages (try `hrce.tn.gov.in`, `asi.nic.in`,
   the district `.nic.in` site, state tourism, the temple's own site).
2. `WebFetch` each promising URL and read what it actually says.
3. `WebSearch`/`WebFetch` Wikipedia and academic sources for history and architecture.
4. For images: search Wikimedia Commons, open the `File:` page, copy the exact author
   and licence string.
5. Write the patch file. Re-read it and check every `sourceIds` entry exists in `sources`.

Quality bar: **2-6 well-chosen sources per temple beats 15 shallow ones.** Prose should
be neutral, specific and encyclopedic — no marketing language, no devotional claims
stated as fact.
