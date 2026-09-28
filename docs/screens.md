# Temple Directory — Screens & Processes

Every screen in the app, who uses it, and the step-by-step process each kind of user goes
through. One login for everyone; what a person can do depends on the roles an admin has
approved on their account.

---

## Part 1 — All screens (20)

### A. Public — no login (4)

| # | Screen | URL | Purpose |
|---|---|---|---|
| 1 | Home | `/` | Search temples; browse by deity, state, type, tradition |
| 2 | Browse | `/browse/<facet>/<value>` | Temple list for one facet, e.g. `/browse/deity/shiva` |
| 3 | Temple page | `/temple/<slug>` | Full temple page — significance, history, how to worship, timings, poojas, festivals, layout, photos, sources. Sidebar: Suggest a correction · Follow · Propose an edit |
| 4 | Status | `/status` | Onboarding dashboard — live / pending / draft counts and completeness per temple. Admins also get approve / publish / reject buttons here |

### B. Account (3)

| # | Screen | URL | Purpose |
|---|---|---|---|
| 5 | Log in | `/login` | One login for all roles, plus "New here? Sign up as…" choices (Devotee, Contributor, Temple Management, Priest, Seva Coordinator) |
| 6 | Sign up | `/signup` | Create an account with an "I'm signing up as" dropdown |
| 7 | My account | `/account` | Personal details · My Temples · My Contributions · My Corrections · Roles & applications · Role tools |

### C. Devotee — any logged-in account (2)

| # | Screen | URL | Purpose |
|---|---|---|---|
| 8 | Suggest a correction | `/temple/<slug>/suggest` | Report something wrong, or a current observation, to the editors |
| 9 | Apply for a role | `/apply/<role>` | Application for Contributor, Temple Management, Priest or Seva Coordinator |

### D. Role holders (4)

| # | Screen | URL | Who | Purpose |
|---|---|---|---|---|
| 10 | Contribute | `/contribute` | Contributor | Add a new temple (153-field form) — saved as a draft |
| 11 | My submissions | `/my-submissions` | Contributor | Temples you added and their review status |
| 12 | Edit submission | `/my-submissions/<slug>/edit` | Contributor | Fix and resubmit a draft or rejected temple |
| 13 | Propose a change | `/temple/<slug>/propose` | Contributor · Temple Management · Priest | Edit a live temple, limited to your role's sections; nothing changes until approved |

### E. Admin (7)

| # | Screen | URL | Purpose |
|---|---|---|---|
| 14 | Admin console | `/admin` | Hub with the count waiting in each queue |
| 15 | Role applications | `/admin/applications` | Approve / reject applications; revoke a held role |
| 16 | Proposed changes | `/admin/revisions` | Field-by-field "now vs proposed" review of edits to live temples |
| 17 | Corrections | `/admin/corrections` | Resolve or dismiss devotee reports |
| 18 | Users | `/admin/users` | Every account and its roles; suspend / reactivate |
| 19 | Audit log | `/admin/audit` | Every approval, rejection, revocation and suspension |
| 20 | Bulk import / export | `/admin/bulk-import` | Excel round trip for the whole directory |

**Redirects:** `/request-access` → Sign up · `/admin/contributor-requests` → Role applications.

---

## Part 2 — Processes

### 1. Visitor (no account)

1. **Home** (`/`) — search, or tap a deity / state chip.
2. **Browse** — pick a temple from the list.
3. **Temple page** — read everything; turn on **Evidence** in the header to see sources and
   verification status.
4. Wants to correct something or follow the temple → sent to **Log in / Sign up**.

### 2. Devotee (new account)

1. **Log in** → "Sign up as… Devotee", or go to **Sign up** directly.
2. **Sign up** — name, mobile, email, city, language, username, password. Role: *Devotee*.
3. Lands on **My account** — active immediately, no approval needed.
4. On any **Temple page**:
   - **Follow temple** → appears under *My Temples*.
   - **Suggest a correction** → **Suggest** screen → choose section, describe, add a source link
     → *Send to editors*.
5. **My account → My Corrections** shows *Pending*, then *Resolved* or *Dismissed* with the
   editor's note.

### 3. Applying for a role (Contributor / Temple Management / Priest / Seva Coordinator)

1. **Log in** → "Sign up as… <role>", **or** pick the role in the **Sign up** dropdown, **or**
   an existing user goes **My account → Roles & applications → Apply**.
2. **Sign up** (new users only) — step 1 of 2.
3. **Apply for a role** — step 2 of 2:
   - Temple roles choose **one temple** from the list.
   - Contributor: location, motivation, temples known, experience, reference link.
   - Temple Management: position, official email and phone, how to confirm affiliation
     (no ID documents).
   - Priest: designation, a temple-management contact who can confirm.
   - Seva Coordinator: temple-management contact, coordination experience.
4. **My account** shows the application as *Applied*.
5. Admin decides (Process 7). The status becomes *Approved* (the role's tools appear under
   **Role tools**) or *Rejected* with a reason.

### 4. Contributor — add a new temple

1. **My account → Role tools → Contributor workspace**, or **Contribute** in the header.
2. **Contribute** — fill the form (identity, location, history, governance, visiting info,
   sources, media, hours, worship SOP, shrines, poojas, festivals). The readiness panel shows %
   complete and missing required fields.
3. *Submit draft for review* → saved as **Draft**.
4. **My submissions** — track status: Draft → Pending → Verified → Published, or Rejected with
   a reason.
5. If rejected → **Edit submission** → fix → *Resubmit for review* (goes back to Pending).
6. Admin reviews it on **Status** (Process 7).

### 5. Contributor — correct a live temple

1. **Temple page** → sidebar **Propose an edit**.
2. **Propose a change** — the full form, pre-filled with the live content.
3. Edit, add a note for the reviewer → *Send change for review*.
4. **My account → My Contributions** shows *Pending*.
5. The admin approves it on **Proposed changes**, and the live page updates. A contributor's
   change never marks anything "authority-verified".

### 6. Temple Management / Priest — keep their temple accurate

1. **My account → Role tools** → "update or confirm official information" (Temple Management)
   or "worship & ritual information" (Priest).
2. **Propose a change** — shows **only their sections**:
   - Temple Management: governance & contact, visiting info, opening hours, pooja & seva,
     festivals, media, sources.
   - Priest: worship SOP, shrines & route, sampradaya / agama, sources.
3. Edit anything wrong, and/or tick **Confirm as current** for sections that are correct as
   they are.
4. Add a note (e.g. "from the notice board") → *Send change for review*.
5. The admin approves it → the live page updates and those sections show **Authority-verified —
   Confirmed by temple management / the temple's priest**.
6. The server refuses any edit outside the role's sections or for another temple.

### 7. Seva Coordinator

1. Apply and get approved (Process 3).
2. **My account → Role tools** shows the coordinator's temple. Volunteer requirements,
   availability and assignments arrive in the next release.

### 8. Admin — daily review

1. **Log in** as admin → header shows **Admin (N)**, N = everything waiting.
2. **Admin console** — pick a queue:
   - **Role applications** — check affiliation against public sources → *Approve*, or *Reject*
     with a reason. Approved roles work on the user's next page load. *Revoke* (with a reason)
     removes a held role.
   - **Temple submissions → Status** — new temples: *Send for review* → *Verify* → *Publish*
     (the publish gate lists any missing required fields), or *Reject* with a reason.
   - **Proposed changes** — read the field-by-field diff → *Approve & publish*, or *Reject*
     with a reason. If the temple changed since the proposal, it is marked **Conflict** instead
     of overwriting.
   - **Corrections** — fix the entry (a proposed change, Excel, or the contributor), then mark
     it *Resolved* with an optional note, or *Dismiss* with a reason.
   - **Users** — *Suspend* (with a reason) blocks login and every role immediately;
     *Reactivate* restores them.
   - **Audit log** — confirm what was decided, by whom, and when.
   - **Bulk import / export** — download the Excel workbook, edit, upload. Changed live temples
     go back to Pending for review.

---

## Part 3 — Who sees what in the header

| Signed in as | Header links |
|---|---|
| Not logged in | Home · Status · Log in · Sign up |
| Devotee | Home · Status · My account · Log out |
| Contributor | + Contribute |
| Temple Management / Priest / Seva Coordinator | Same as Devotee — their tools are in **My account → Role tools** |
| Admin | Home · Status · My account · **Admin (N waiting)** · Log out |

## Part 4 — The approval rule

Nothing is public, and no role works, until an admin approves it:

```
Sign up ──► Devotee (active at once)
Apply for role ──► Applied ──admin──► Approved / Rejected
New temple ──► Draft ──► Pending ──admin──► Verified ──admin──► Published   (or Rejected)
Edit to live temple ──► Pending ──admin──► Approved (live) / Rejected / Conflict
Correction ──► Pending ──admin──► Resolved / Dismissed
```
