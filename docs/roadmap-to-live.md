# Temple Directory — Roadmap to Live

As of 2026-09-25. See also [`screens.md`](screens.md) and [`contributor-columns.md`](contributor-columns.md).

Already built: 63 temples (59 live), public site, one login with 6 roles, admin approval of
everything, audit log, 28 tests. Everything below is what's left.

## 1. Make it real (code, about 6–8 weeks)

- **Login that works for the public:** phone OTP and/or Google, forgot password, sessions.
- **Save everything to a real database (Supabase):** accounts, roles, temples, revisions,
  corrections, follows. Today it's JSON files, which are safe for one server only.
- **Consent:** each yes/no stored separately, plus data export and account deletion.
- **Admins:** individual admin logins, limits on repeated login attempts, daily backups.
- **Seva system:** requirements, volunteer calendar, assignments, attendance, completion
  photos, feedback.
- **Photo uploads** for corrections, seva and temple media, with admin review of photo rights.
- **Notifications:** email/SMS when an application or submission is approved or rejected.
- **Map** on temple pages (all 63 temples already have coordinates).
- **Outdated-data flags:** timings and festivals not confirmed in 90 days.
- **Analytics events**, so you can see which temples and features people actually use.

## 2. Real data sources (connect these)

| Data | Source | Cost | Sign-up |
|---|---|---|---|
| Temple history, significance | Wikipedia / Wikidata | Free (attribution required) | None (already used) |
| Temple photos | Wikimedia Commons | Free (per-photo license and credit) | None (already used) |
| More temples + coordinates | OpenStreetMap (Hindu places of worship) | Free (attribution required) | None |
| Map on temple page | Google Maps Embed API | Free, unlimited | Google Cloud project + key |
| "Temples near me" map | Google Maps JavaScript API | 10,000 loads/month free, then ~$7 per 1,000 | Same Google project + card |
| Hours, phone, visitor ratings | Google Places API | Free up to a monthly limit, then paid | Same Google project + card |
| Official timings, sevas, fees | Temple and state endowment websites (e.g. TN HR&CE, TTD) | Free | None, but no API: copy by hand and cite |
| Festival dates | Temple announcements / panchang | Free | No reliable free API; entered by the team or temple |
| Indian-language text | Bhashini (Government of India) or Google Cloud Translation | Bhashini free; Google paid per character | Bhashini registration / Google card |
| Worship steps, verified timings | Your own priests and temple management | Free | Built in (roles + approval) |
| Corrections, current conditions | Your own devotees | Free | Built in |

The seeding approach: take temple lists and coordinates from OpenStreetMap for the pilot state,
facts and photos from Wikipedia/Commons, and store only Google place IDs (Google's terms allow
little else to be stored). Fetch ratings and hours live, and let temple authorities confirm the
official details.

## 3. Content your team must create (the real bottleneck)

- **Worship steps (SOP)** for the 61 of 63 temples that have none.
- **Verified timings, pooja and seva lists with prices** for every temple, confirmed with each
  temple.
- **Festival calendar** with this year's dates for each temple.
- **Priest and temple-management onboarding:** recruit 1–2 per pilot temple to verify content.
- **Photo rights:** replace or confirm images, and credit every one.
- **Translations:** Tamil first, then Hindi, Telugu, Kannada and Malayalam.
- **More temples** beyond 63, starting with the pilot state.

This is months of work and needs a content person plus temple outreach. No API offers verified,
temple-specific worship content.

## 4. Legal and trust (before real users)

- **Privacy Policy and Terms**, reviewed by a lawyer.
- **Consent wording** under DPDP, India's data protection law. The site collects names, phones
  and emails.
- **Moderation policy** for corrections, reviews and photos.
- **Religious-content policy:** mantras and worship order are shown only when a temple authority
  has verified them (already enforced in code). Write it down publicly.
- **Permission to use official temple content** and names or logos where needed.
- **Donations:** the Akhand Deepam lamp widget is a mock. Real donations need a payment gateway,
  legal review, and 80G receipts if tax-exempt.

## 5. Go live

- **Hosting on Render** (render.yaml ready) with a disk, then Supabase.
- **A domain, email sending** (password reset and notifications), and **file storage** for photos.
- **DLT registration** (TRAI) before any SMS OTP in India.
- **Error tracking, uptime alerts** and **daily backups**.
- **Google budget alert and daily caps** on the Maps and Places APIs.
- **A pilot state (Tamil Nadu: 12 temples already in)** with 50–100 test users, and 2–3 temples'
  priests or management on board.

## 6. Mantra & sloka section

> **Built 2026-09-28** (branch `feat/mantras`). A shared library of 16 sourced slokas covers all
> 63 temples (Ganesha invocation plus the deity's slokas; the Jyotirlinga smaranam on the 12
> Jyotirlingas). 7 temples have a temple-specific hymn waiting for their priest. Gaps: no Brahma
> sloka yet (Pushkar shows only the Ganesha invocation); Tamil Thevaram/Prabandham verses, audio
> and the `/mantras` page are not built. Sources: `research/2026-09-28-mantra-sources.md`.

**Today:** each worship step has one free-text `mantraOrSloka` field, shown only once that step
is priest-verified. **0 of 63 temples use it.** It has no transliteration, meaning, audio, or
link to a deity, shrine or festival.

**Decided (2026-09-25):** general deity slokas can be shown before a priest confirms them, clearly
labelled. Temple-specific hymns still need the priest. Each mantra carries its text,
transliteration and meaning; audio comes later.

### 6.1 Two kinds of mantra

| | **A. Deity sloka (general)** | **B. Temple-specific hymn** |
|---|---|---|
| What | The same sloka everywhere that deity is worshipped | Composed about this temple, or part of its own ritual |
| Examples | *Vakratunda Mahakaya* (Ganesha) · *Om Namah Shivaya* · *Shantakaram* (Vishnu) · *Sarva Mangala Mangalye* (Devi) · *Om Saravanabhava* (Murugan) · *Swamiye Saranam Ayyappa* · Aditya Hridayam (Surya) | Jyotirlinga verse · Thevaram padigam · Divya Prabandham pasuram · *Venkatesa Suprabhatam* (Tirumala) · *Harivarasanam* (Sabarimala) · *Narayaneeyam* (Guruvayur) · *Meenakshi Pancharatnam* (Madurai) · *Jagannathashtakam* (Puri) |
| Stored | **Once**, in a shared library | On the temple, linked to its step, shrine or festival |
| Linked by | The temple's presiding deity | The temple (and optionally a shrine / festival) |
| Can show publicly | **Yes, before priest confirmation**, labelled *"Traditional sloka for Shiva — not yet confirmed by this temple"* | **Only after priest verification**, labelled *"Confirmed by the temple's priest"* |
| Who confirms | Admin checks the text against a published source | The temple's priest; then the admin approves |

### 6.2 Temple-specific groups already in the directory

| Group | Temples here |
|---|---|
| **12 Jyotirlingas** (Dwadasa Jyotirlinga Stotram, one verse per temple) | All 12: Somnath · Mallikarjuna · Mahakaleshwar · Omkareshwar · Kedarnath · Bhimashankar · Kashi Vishwanath · Trimbakeshwar · Vaidyanath · Nageshwar · Rameswaram · Grishneshwar |
| **Thevaram** — Paadal Petra Sthalams (Tamil Shaiva) | Chidambaram · Thiruvannamalai · Kanchi Ekambareswarar · Thiruvanaikaval · Rameswaram |
| **Divya Prabandham** — Divya Desams (Tamil Vaishnava) | Srirangam · Tirumala · Sarangapani · Padmanabhaswamy · Badrinath · Dwarka · Mathura · Ayodhya |
| **Daily ritual songs** | Tirumala (Suprabhatam, dawn) · Sabarimala (Harivarasanam, closing) |
| **Hymns written for the temple** | Guruvayur · Madurai · Kanchi Kamakshi · Puri · Kashi · Kolhapur |
| **Pilgrim chants** | Vaishno Devi · Sabarimala |

*These names and attributions are from general knowledge. Each must be checked against a
published source before any text is entered.*

### 6.3 How it fits into the directory

**Data** — a new 10th sheet, `10_Mantras`, running through the same pipeline as the other nine
(Excel import/export, contributor form, validation, revisions, admin approval).

| Field | Purpose |
|---|---|
| `mantra_id`, `title` | ID and name |
| `kind` | `deity` (general, library) or `temple` (temple-specific) |
| `deity` / `temple_id` | What it belongs to |
| `group` | Jyotirlinga · Thevaram · Divya Prabandham · Suprabhatam · Stotram · Pilgrim chant |
| `text_original`, `script` | Devanagari, Tamil, … |
| `transliteration` | Roman script (IAST) |
| `meaning` | Plain-English meaning |
| `source_text`, `source_ids` | Where the text comes from |
| `when_chanted`, `repetitions` | Entry · pradakshina · archana · aarti · festival · closing; e.g. 3, 11, 108 |
| `linked_step / shrine / festival` | Where it appears on the page |
| `restriction` | `public` or `name_only` (initiation / diksha needed; text never shown) |
| `audio_url`, `audio_license` | Later (needs file storage) |
| `verification_status`, `verified_by` | Evidence and sign-off |

**On the temple page:**

1. **New "Prayers & slokas" section**, after *How to worship*:
   - First, **"At this temple"**: temple-specific hymns (priest-verified only).
   - Then, **"Traditional slokas for <deity>"**: general slokas from the library.
   - Each card shows the original text, a **transliteration / meaning** toggle, when it's
     chanted and how many times, its source, and a verification badge.
2. **How to worship** step cards show the linked mantra inline.
3. **Shrine route** and **Festivals** show their linked slokas.
4. A **hymn-group badge** in *At a glance*, e.g. "Jyotirlinga", "Divya Desam", "Paadal Petra
   Sthalam".
5. Later: a **`/mantras` library** to browse by deity, linking to every temple that uses each one.

**Roles and approval:**

| Who | Can do |
|---|---|
| Contributor | Propose either kind, with a source; saved as *Sourced* |
| Priest (of that temple) | Add or correct temple-specific hymns, set the restriction, confirm → *Authority-verified*. `mantras` becomes a new priest area in `fieldAuthority.ts` |
| Admin | Approve everything; manage the shared deity library |
| Devotee | Report a wrong word via *Suggest a correction* → new option "Mantra / sloka" |

### 6.4 Rules

- A temple-specific hymn is **never** public without the temple priest's verification.
- A general deity sloka may show before that, but **always labelled** as not yet confirmed by
  this temple, and **only if** its text has been checked against a cited published source.
- `name_only` mantras show the name and "chanted by initiated devotees / priests only", never
  the text.
- **Copyright:** ancient texts are public domain; modern translations, commentaries and recordings
  are not. Write your own meanings; use temple-made or licensed audio.
- **Tradition-aware:** Shaiva, Vaishnava and Shakta practice differ, so the priest of that
  tradition decides.
- Accuracy over quantity: one checked sloka beats ten unchecked ones.

### 6.5 What needs to be done

**Code (~2 weeks)**

1. Add the `10_Mantras` sheet to the input workbook, then run `npm run gen:schema`; add types and
   validation (a temple-kind mantra is not public unless authority-verified; `name_only` hides text)
2. Shared deity library + linking by presiding deity
3. Contributor/priest form section; add `mantras` to the priest's areas in `fieldAuthority.ts`
4. Temple page: "Prayers & slokas" section, inline mantras in steps / shrines / festivals,
   transliteration–meaning toggle, hymn-group badge
5. "Mantra / sloka" option in *Suggest a correction*
6. Excel import/export round trip, tests, browser check
7. Later: `/mantras` library page; audio (after Supabase storage)

**Content (the real work)**

1. **Deity library first:** ~15–20 general slokas covering every presiding deity in the 63
   temples. Each has original text, transliteration, meaning, and a cited published source,
   checked by the admin.
2. **Jyotirlinga verses** for the 12 Jyotirlinga temples, from the Dwadasa Jyotirlinga Stotram.
   Temple-specific, so they wait for priest confirmation.
3. **Tamil hymns:** one Thevaram padigam / Divya Prabandham pasuram per Tamil temple, sourced.
4. **Priest outreach:** ask each pilot temple's priest to confirm or replace these, add their
   own daily chants, and mark any restricted mantras.
5. **Meanings:** write original English meanings (and later Tamil / Hindi) rather than copying
   modern translations.

**Cost:** no API or paid service. Audio later uses the same file storage as photos.

## Costs at a glance

| Item | Cost |
|---|---|
| Domain | ~₹800–1,500 / year |
| Render Starter + 1 GB disk | $7.25 / month (~₹620) |
| Supabase | Free to start → $25 / month |
| SMS OTP (e.g. MSG91) | ~₹0.15–0.25 per OTP + GST |
| DLT registration | ~₹11,800 + GST one-time |
| Google Maps Embed / Places / JS | Free tiers; paid only past the limits (set caps) |
| Email, error tracking, Search Console | Free tiers to start |

Pilot ≈ ₹620/month + domain. Prices checked September 2026, so re-check before buying:
[Render](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses) ·
[Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase) ·
[Google Maps](https://developers.google.com/maps/billing-and-pricing/overview) ·
[MSG91](https://msg91.com/in/pricing/otp) · [DLT](https://msg91.com/help/dlt-registration-in-india)

## Decisions needed

1. Domain name
2. Pilot state and the 2–3 temples to onboard first
3. Login: phone OTP (paid + DLT), Google (free), or both
4. After launch: seva system first, or worship content first
5. Map: free embed only, or also "temples near me"
6. Real donations: yes (needs a payment gateway + legal) or keep the mock
7. Mantras: which scripts first (Devanagari, Tamil)? Who at CNESS checks deity-sloka texts against sources?
