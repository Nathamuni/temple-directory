# Contributor Form — All Columns

Every field a contributor can fill on `/contribute`, in the order the form shows it. Generated from `src/lib/schema.ts` (the single source for the form, Excel import and publish gate) and `src/components/contribute/TempleForm.tsx`.

- **Required** — the entry cannot be published without it.
- **Recommended** — shown up front; counts toward the completeness score.
- **Optional** — tucked under "more fields".
- **Repeatable** sections take any number of rows (e.g. one row per festival).

## 1. Temple identity

_Sheet: 01_Temple_Master_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `temple_name_en` | Text | Required | Official/common English name |
| `temple_name_local` | Text | Recommended | Name in regional script |
| `local_language` | Lookup — pick from *Language* | Recommended | Primary local language |
| `alternate_names` | Text (list, `;`-separated) | Optional | Semicolon-separated alternate names |
| `presiding_deity` | Text | Required | Main deity |
| `presiding_deity_local` | Text | Optional | Regional-script deity name |
| `consort_deity` | Text | Optional | Consort / paired deity where relevant |
| `temple_tradition` | Lookup — pick from *Temple Tradition* | Required | Shaiva / Vaishnava / Shakta / etc. |
| `sampradaya_agama` | Text | Optional | Specific sampradaya/agama only if sourced |
| `temple_type` | Lookup | Required | Temple type/category |
| `sacred_classifications` | Text (list, `;`-separated) | Optional | Pancha Bhuta, Divya Desam, Jyotirlinga, etc. |

## 2. Location

_Sheet: 01_Temple_Master_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `city` | Text | Required | City/town |
| `district` | Text | Required | District/county |
| `state_province` | Text | Required | State/province |
| `country` | Text | Required | Country |
| `postal_code` | Text | Recommended | PIN/ZIP/postcode |
| `latitude` | Decimal | Recommended | Latitude |
| `longitude` | Decimal | Recommended | Longitude |
| `map_url` | URL | Optional | Map link |

## 3. Sacred identity & history

_Sheet: 01_Temple_Master_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `spiritual_significance_short` | Long text | Required | Short devotional significance shown near top |
| `summary_intro` | Long text | Required | 100–180 word page introduction |
| `sthala_puranam` | Long text | Optional | Traditional / devotional account, clearly labelled |
| `documented_history` | Long text | Required | Historically documented chronology |
| `architecture_style` | Text | Recommended | Dravidian / Nagara / Vesara / regional |
| `sacred_tree` | Text | Optional | Sthala Vriksham |
| `sacred_tank` | Text | Optional | Theertham / sacred tank |
| `sacred_text_references` | Text | Optional | Textual references; detailed citations live in Sources |
| `associated_saints` | Text (list, `;`-separated) | Optional | Saints/acharyas/poets |
| `inscriptions_summary` | Long text | Optional | Summary of inscriptions / epigraphy |

## 4. Governance & contact

_Sheet: 01_Temple_Master_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `established_era` | Text | Recommended | Era / century; avoid false precision |
| `founder_patron` | Text | Optional | Founder / patron if documented |
| `managing_authority` | Text | Recommended | Trust, board, department, committee |
| `administration_type` | Lookup — pick from *Administration Type* | Optional | Trust / govt / hereditary / committee / other |
| `official_website` | URL | Optional | Official site |
| `official_phone` | Text | Optional | Public phone |
| `official_email` | Text | Optional | Public email |

## 5. Visiting information

_Sheet: 02_Visiting_Info_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `dress_code` | Long text | Recommended | Current temple-specific dress requirements |
| `entry_rules` | Long text | Recommended | Entry restrictions / special rules |
| `footwear_rules` | Long text | Recommended | Removal/storage guidance |
| `photography_policy` | Long text | Recommended | Still/video policy; date-stamp it |
| `mobile_policy` | Long text | Optional | Phone/device rules |
| `prasad_info` | Long text | Optional | Counter/location/timings |
| `accessibility_notes` | Long text | Recommended | Wheelchair/senior citizen/assistance info |
| `parking_notes` | Long text | Optional | Parking location/capacity |
| `accommodation_notes` | Long text | Optional | Temple choultry/dharamshala/nearby stays |
| `nearest_rail_station` | Text | Optional | Nearest rail station |
| `rail_distance_km` | Decimal | Optional | Approx distance |
| `nearest_bus_station` | Text | Optional | Nearest bus station |
| `bus_distance_km` | Decimal | Optional | Approx distance |
| `nearest_airport` | Text | Optional | Nearest airport |
| `airport_distance_km` | Decimal | Optional | Approx distance |
| `official_contact_note` | Long text | Optional | How to confirm same-day info |
| `last_verified_date` | Date | Required | Date practical info was checked |
| `verification_status` | Lookup — pick from *Verification Status* | Required | unverified / partial / verified / conflict |

## 6. Sources (repeatable)

_Sheet: 09_Sources_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `source_id` | Text | Required | Unique source ID |
| `source_type` | Lookup — pick from *Source Type* | Required | official temple / government / scripture / academic / inscription / priest / on-site / media / other |
| `title` | Text | Required | Source title |
| `publisher_or_authority` | Text | Recommended | Publisher/authority |
| `author` | Text | Optional | Named author |
| `url` | URL | Optional | Web URL |
| `publication_date` | Date/Text | Optional | Publication date/year |
| `access_date` | Date | Required | When checked |
| `page_or_section` | Text | Optional | Page/section/paragraph |
| `claim_scope` | Long text | Required | What claim(s) this source supports |
| `reliability_note` | Long text | Optional | Limitations/conflicts |
| `archived_url` | URL | Optional | Archive link |
| `admin_approved` | Boolean | Required | Source accepted by editor? |

## 7. Media (repeatable)

_Sheet: 08_Media_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `media_id` | Text | Required | Unique media ID |
| `media_type` | Lookup — pick from *Media Type* | Required | image / video / audio / map / document |
| `category` | Lookup — pick from *Media Category* | Required | hero / gopuram / tank / shrine / SOP / festival / architecture / signage / map / other |
| `title` | Text | Required | Short media title |
| `caption` | Long text | Required | What it shows |
| `alt_text` | Long text | Required | Accessibility text |
| `file_or_url` | URL/Text | Required | Uploaded path or URL |
| `creator` | Text | Recommended | Photographer/creator |
| `capture_date` | Date | Optional | Date created/captured |
| `license` | Text | Required | Usage license / permission |
| `attribution_text` | Text | Required | Display attribution |
| `source_url` | URL | Recommended | Original source page |
| `linked_sop_step_id` | Text | Optional | Place media within SOP |
| `linked_shrine_id` | Text | Optional | Place media with shrine |
| `editorial_approved` | Boolean | Required | Rights/content review complete? |
| `verification_status` | Lookup — pick from *Verification Status* | Required | pending / approved / rejected |

## 8. Opening hours (repeatable)

_Sheet: 03_Opening_Hours_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `hours_id` | Text | Required | Unique schedule row ID |
| `day_type` | Lookup — pick from *Day Type* | Required | daily / weekday / weekend / festival / special |
| `valid_from` | Date | Optional | Effective start date |
| `valid_to` | Date | Optional | Effective end date |
| `session_name` | Text | Required | Morning / Evening / Special |
| `open_time` | Time | Optional | Opening time |
| `close_time` | Time | Optional | Closing time |
| `closed_flag` | Boolean | Required | TRUE if closed |
| `festival_override` | Boolean | Optional | Whether this is an override |
| `notes` | Long text | Optional | Breaks / queue / variation notes |
| `source_ids` | Text (list, `;`-separated) | Required | Supporting sources |
| `last_verified_date` | Date | Required | Current check date |
| `verification_status` | Lookup — pick from *Verification Status* | Required | verified / conflict / needs recheck |

## 9. Worship SOP (repeatable)

_Sheet: 04_Worship_SOP_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `sop_step_id` | Text | Required | Unique row ID |
| `step_number` | Integer | Required | 1–6 |
| `step_title` | Text | Required | Public title |
| `instruction` | Long text | Required | Temple-specific worship/visit instruction |
| `explanation` | Long text | Recommended | Why/context |
| `local_terms` | Text | Optional | Regional terms |
| `mantra_or_sloka` | Long text | Optional | Only when properly sourced/approved |
| `what_to_carry` | Text | Optional | Offerings/items |
| `restriction_or_caution` | Long text | Optional | Temple-specific caution |
| `linked_shrine_ids` | Text (list, `;`-separated) | Optional | Related shrine IDs |
| `linked_media_ids` | Text (list, `;`-separated) | Optional | Related image/video IDs |
| `source_ids` | Text (list, `;`-separated) | Required | Supporting sources |
| `authority_reviewer` | Text | Recommended | Priest/temple authority/editor |
| `authority_review_date` | Date | Recommended | Authority sign-off date |
| `verification_status` | Lookup — pick from *Verification Status* | Required | draft / sourced / authority-verified / conflict |
| `editor_notes` | Long text | Optional | Internal notes |

## 10. Shrines & route (repeatable)

_Sheet: 05_Shrines_Route_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `shrine_id` | Text | Required | Unique shrine ID |
| `sequence_number` | Integer | Optional | Only if exact worship order is verified |
| `shrine_name` | Text | Required | Shrine/hall/sacred-space name |
| `deity_or_subject` | Text | Optional | Deity / sacred subject |
| `local_name` | Text | Optional | Regional-script name |
| `space_type` | Lookup — pick from *Space Type* | Required | shrine / sabha / tank / tree / gopuram / hall / other |
| `location_description` | Text | Recommended | Where it is in complex |
| `route_direction` | Long text | Optional | Directions from prior point |
| `recommended_action` | Long text | Optional | Temple-specific action only if verified |
| `pradakshina_count` | Integer | Optional | Only if verified |
| `linked_media_ids` | Text (list, `;`-separated) | Optional | Related media |
| `source_ids` | Text (list, `;`-separated) | Required | Supporting sources |
| `verification_status` | Lookup — pick from *Verification Status* | Required | unverified / sourced / authority-verified |

## 11. Pooja & seva (repeatable)

_Sheet: 06_Pooja_Seva_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `pooja_id` | Text | Required | Unique pooja/seva ID |
| `record_type` | Lookup — pick from *Record Type* | Required | pooja / aarti / seva / abhishekam / archana |
| `name_en` | Text | Required | Name |
| `name_local` | Text | Optional | Regional-script name |
| `start_time` | Time | Optional | Start time |
| `end_time` | Time | Optional | End time |
| `recurrence` | Text | Recommended | Daily / weekly / star day / festival |
| `description` | Long text | Recommended | What the event is |
| `devotee_participation` | Long text | Optional | How devotees may participate |
| `booking_method` | Long text | Optional | Counter/online/temple contact |
| `fee_note` | Text | Optional | Only if current and officially sourced |
| `linked_media_ids` | Text (list, `;`-separated) | Optional | Related media |
| `source_ids` | Text (list, `;`-separated) | Required | Supporting sources |
| `last_verified_date` | Date | Required | Checked date |
| `verification_status` | Lookup — pick from *Verification Status* | Required | verified / conflict / needs recheck |

## 12. Festivals (repeatable)

_Sheet: 07_Festivals_

| Column | Type | Requirement | What to enter |
|---|---|---|---|
| `festival_id` | Text | Required | Unique festival ID |
| `festival_name_en` | Text | Required | Festival name |
| `festival_name_local` | Text | Optional | Regional-script name |
| `tamil_or_local_month` | Text | Optional | Local calendar month |
| `gregorian_rule_or_date` | Text | Recommended | Date or calculation rule |
| `duration` | Text | Optional | 1 day / 10 days / etc. |
| `significance` | Long text | Required | Why it matters here |
| `procession_or_rituals` | Long text | Optional | Key temple-specific events |
| `crowd_note` | Text | Optional | Operational note |
| `visitor_advice` | Long text | Optional | Visit planning note |
| `linked_media_ids` | Text (list, `;`-separated) | Optional | Photos/videos |
| `source_ids` | Text (list, `;`-separated) | Required | Supporting sources |
| `verification_status` | Lookup — pick from *Verification Status* | Required | verified / partial / needs recheck |

---

**Total contributor-fillable columns: 153**

Temple Master columns in the schema but **not on the form** (admin / Excel only): `temple_id`, `temple_slug`, `primary_language`, `public_status`, `overall_verification_status`, `last_verified_date`, `verification_notes`
