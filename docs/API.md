# API

JSON over HTTP, same origin as the site. Writes must be `Content-Type: application/json` (this is the CSRF guard). Errors are `{ "error": "message" }` with a normal HTTP status; "needs sign-in" errors also carry `"code": "SIGN_IN_REQUIRED"`.

## Open: no sign-in
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ ok, db, temples }` |
| GET | `/api/config` | countries and counts |
| GET | `/api/temples/:id` | one temple (tags, enrichment, computed fields) |
| GET | `/api/temples` | `?state&district&country&q&limit&offset` |
| GET | `/api/community/:templeId` | per checklist item: average, count, my rating, visible comments (with upvote counts) |
| POST | `/api/ratings` | `{ templeId, itemKey, stars 1-5, displayName?, email?, consent? }` one rating per browser per item; re-rating replaces |
| POST | `/api/comments` | `{ templeId, itemKey, text 5-500, displayName? }` plain text; cooldown 20 s, 10 per hour, 5 per temple per browser |
| POST | `/api/upvotes` | `{ commentId }` toggles this browser's upvote. **Upvote only**; no downvote; no self-upvote |
| GET | `/api/community-summary` | top rated (min 3 ratings), most upvoted, per-item averages |
| GET | `/api/fields/:templeId` | approved volunteer values (+ your own pending ones when signed in) |
| GET | `/api/needs` | `?templeId&state&status&category` approved reports (+ your own pending) |
| GET | `/api/notes/:templeId` | approved notes (+ your own pending) |
| GET | `/api/export/temples.ndjson` `.csv` `.geojson`, `/api/export/community.json` | complete open exports, never any email |

`itemKey` values are in `data/facilities-checklist.json`. A hidden honeypot field named `website` is silently ignored if filled.

## Sign-in
| Method | Path | Notes |
|---|---|---|
| GET | `/api/me` | `{ user, approvalRequired, signIn }` |
| POST | `/api/auth/sign-in` | `{ email, displayName }`: stores the name and email and signs you in. **No verification** (temporary). Never grants admin; an existing admin's email returns 403 |
| POST | `/api/auth/logout` | |
| POST | `/api/auth/dev-admin` | dummy admin; on in development (`DEV_LINKS=1`, not production) or when `ALLOW_DEV_ADMIN=1`. Any visitor can use it |

The emailed-link routes (`/api/auth/request-link`, `/api/auth/verify`) are commented out in `server/routes/auth.js` and return 404 until re-enabled.

## Volunteer (sign-in required)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/fields` | `{ templeId, fieldKey, value, sourceType, sourceRef, checkedOn }`; field keys and accepted source types come from `data/field-schema.json` |
| POST | `/api/needs` | `{ templeId, category, area, severity, title, description (20+), observedOn, evidence? }` |
| POST | `/api/needs/:id/status` | `{ status: Open | In progress | Resolved }`; admins only while approval is on |
| POST | `/api/notes` | `{ templeId, type, text (15+), basis }` |
| GET | `/api/my-submissions` | your items with `approval` (`pending` / `approved` / `rejected`) and the rejection reason |

Each write response carries `pending: true|false`. With approval **off** (default) it is `false` and the change is live; with approval **on** it is `true` until an admin decides. Admins always publish directly.

## Admin
| Method | Path | Notes |
|---|---|---|
| GET / POST | `/api/admin/settings` | `{ requireApproval: boolean }` the approval switch |
| GET | `/api/admin/pending` | queue of pending field values, needs reports and notes |
| POST | `/api/admin/pending/:kind/:id/decide` | `kind` = `field` / `need` / `note`; `{ decision: approve | reject, reason? }` |
| POST | `/api/admin/pending/approve-all` | |
| GET | `/api/admin/edits` | change log (latest 200) |
| POST | `/api/admin/edits/:id/revert` | undo a change that went live (or an approval-switch change) |
| POST | `/api/admin/comments/:id/hide` | `{ hidden: true|false }` |
