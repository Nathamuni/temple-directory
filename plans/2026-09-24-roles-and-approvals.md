# Roles & Admin Approvals — Temple Directory

## Context
Today the app has 2 hard-coded roles (`admin`, `contributor`), a 7-day cookie that bakes the role in, contributor passwords stored **in plaintext** in `contributor-requests.json`, and role checks copy-pasted inline in 12 places. The user's spec (pasted in chat) asks for **one login, one account, many approved roles, temple-specific**: Devotee, Contributor, Temple Management, Priest, Seva Coordinator, Admin. User decisions (2026-09-24):
- **Storage: local JSON files now** ("local structure ready for us"), behind one store layer so Supabase later is a contained swap.
- **Scope: roles + approvals this round.** Seva volunteer system (calendar, assignments, attendance) is next round — Seva Coordinator gets application + approval + an empty workspace only.
- **Admin approves everything** before it goes public: every role application, new temple, edit, correction. A priest/temple-management edit that the admin approves also stamps the records `authority-verified`.

Also fixes two defects found while mapping: QuickCorrection links to a flow that silently drops the correction (`QuickCorrection.tsx:29`, `/contribute` never reads `?correction=`), and login's `next` param is an open redirect (`api/auth/login/route.ts:20`).

## Design

### Storage — `src/lib/store/` (all file I/O goes through here)
- `jsonStore.ts` — read / atomic write (tmp + rename) under `DATA_ROOT` (`src/lib/dataDir.ts`), with an in-process write queue. **Single-instance only** (fine for local + one Render instance; documented).
- `users.json` — `User { id, username, name, email, phone, city?, language?, passwordHash, status: active|suspended, createdAt }`. Hash = Node `crypto.scrypt` + per-user salt, `timingSafeEqual` compare. No new dependency.
- `role-grants.json` — `RoleGrant { id, userId, role, templeSlug|null, status: applied|approved|rejected|revoked, application: {...}, appliedAt, reviewedBy?, reviewedAt?, reason? }`. `devotee` is implicit for every active user; `contributor` global; `temple_management | priest | seva_coordinator` require `templeSlug`; `admin` stays the env-configured built-in (`src/lib/users.ts` `builtInPassword`).
- `revisions/<id>.json` — proposed change to a **published** temple (public version stays live until approved): `{ id, templeSlug, baseUpdatedAt, proposed: Temple, changedPaths[], submittedBy, actingRole, status: pending|approved|rejected|conflict, reviewedBy?, reason? }`.
- `corrections.json` — devotee correction/observation: `{ id, templeSlug, section, message, sourceUrl?, submittedBy, status: pending|resolved|dismissed, ... }`.
- `follows.json` — `{ userId, templeSlug }[]`.
- `audit.jsonl` — append-only: who, action, target, when. Every approve/reject/revoke/suspend writes one line.
- **Migration** (`scripts/migrate-accounts.mts`, also run by `ensureDataDir` once): each `contributor-requests.json` row → `User` (password hashed) + `contributor` grant with the same status; then the file's plaintext passwords are removed. Idempotent.

### Session & permissions
- `src/lib/session.ts`: cookie keeps its HMAC format but carries `{ userId, exp }` only. Roles are loaded **per request** from the store, so approval, revocation and suspension take effect immediately.
- New `src/lib/authz.ts`: `getViewer()` → `{ user, grants } | null`; `hasRole(viewer, role, templeSlug?)`; `requireViewer()` / `requireAdmin()` for pages and routes. **Replaces all 12 inline checks** listed in exploration (SiteHeader, contribute, edit/status routes, admin pages, my-submissions, temple preview).
- Login `next` restricted to same-origin paths starting with `/`.

### Field authority — `src/lib/fieldAuthority.ts`
Maps each sheet (and the Governance group of `01_Temple_Master`) to the role that can *vouch* for it:
- `temple_management`: 02 Visiting Info, 03 Opening Hours, 06 Pooja & Seva, 07 Festivals, governance/contact columns.
- `priest`: 04 Worship SOP, 05 Shrines & Route, `sampradaya_agama`.
- everything else: contributor-researched, admin-verified.
Server enforces it: a revision from a temple-scoped role is diffed against the current temple (paths from `FIELD_SPECS` in `src/lib/schema.ts`); touching anything outside that role's sheets, or another temple, is rejected with 403. Contributors may edit any field but never earn `authority-verified`.

### Flows
| Who | Flow |
|---|---|
| Anyone | `/signup` → active devotee account (no approval needed, per spec) |
| Devotee | `/apply/[role]` — role-specific application fields from the spec. **No ID documents stored**: Temple Management gives position + official email/phone + official website/letter reference as text. |
| Devotee | Fixed QuickCorrection → `/temple/[slug]/suggest` → `corrections.json` pending → admin queue |
| Devotee | Follow / unfollow temple → "My Temples" |
| Contributor | Existing draft flow unchanged (`createDraftTemple`, `updateDraftTemple` in `src/lib/temples.ts`); plus "Propose edit" on published temples → revision |
| Temple Mgmt / Priest | Workspace lists their temple(s); edit only their authority sheets → revision; "Confirm as current" on a section → revision that only changes verification |
| Seva Coordinator | Application + approval; workspace placeholder ("Seva tools arrive next") |
| Admin | `/admin` console: Role applications · Temple submissions (existing `/status` flow) · Revisions (field-level diff, approve/reject+reason, conflict if `baseUpdatedAt` moved) · Corrections · Users (suspend, revoke grant) · Audit log |

On revision approval: merge `proposed` → `writeTempleFile`; records in the acting role's sheets get `verificationStatus: "authority-verified"`, `lastVerifiedDate`, and a new `verifiedBy { userId, role }` on `Provenance` (`src/lib/types.ts:69`). Existing `Evidence.tsx` `VERIFIED_LABEL` shows the badge ("Verified by temple" / "Authority verified").

### UI
- `/account` dashboard exactly as the spec's sidebar: My Account · My Temples · My Contributions · My Corrections | Role tools (only approved roles) | Admin. `SiteHeader.tsx` shows one "My account" entry + admin badge count.
- `/login` stays single. Dev credentials block removed from `login/page.tsx:67-73` in production.
- `scripts/build-static.sh:18` move-list gains `signup apply account temple/[slug]/suggest` (static build stays read-only).

## Delivery (commits on a new branch `feat/roles-and-approvals`)
1. Store layer + password hashing + migration + session-by-userId + `authz.ts`; swap the 12 inline checks. *No visible change.*
2. Signup, `/apply/[role]`, admin Role-applications queue, `/account`, header.
3. Revisions + field authority + admin diff review + authority-verified stamping.
4. Corrections (QuickCorrection fix) + follows.
5. Admin Users (suspend/revoke) + audit log view. README "Known limits" + `.env.example` updated.
A copy of this plan goes to `plans/2026-09-24-roles-and-approvals.md` (multi-session work).

## Verification
- **Baseline first:** `npm run typecheck`, `npm run check`, `npm run build` on current HEAD; record results.
- **Add `vitest`** (dev dep, first test runner in the repo — approving this plan approves it). Tests: password hash/verify; migration idempotence + no plaintext left; authz matrix (priest of temple A → 403 on temple B; temple_management touching Worship SOP → 403; suspended user → no access; revoked grant effective next request); revision conflict when base changed; `next` redirect rejects `//evil.com` and absolute URLs.
- **Browser (agent-browser, visual-qa):** signup → apply as priest for Kapaleeshwarar → admin approves → priest edits Worship SOP → admin approves diff → public page shows "Authority verified". Plus the devotee correction → admin queue path, and the existing contributor draft → publish path (regression).
- `npm run build:static` still produces a read-only export.
- **Memory:** the machine reaps background processes when RAM is low (dev server was killed today) — run one server at a time; stop the stale port-3000 server first with the user's OK.

## Out of scope this round
Seva system (requirements, availability calendar, assignments, attendance, completion photos, feedback), photo uploads, OTP/Google login, Supabase, merge-duplicates tool, managing dropdown vocabularies in UI.
