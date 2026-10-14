# Deploy and move

The app is one Docker image (Node 22 serving the site and the API) plus **any Postgres**. Everything is configured with environment variables, so moving between hosts means changing `DATABASE_URL` and nothing else.

## Run locally (one command)
```bash
docker compose up --build     # http://localhost:8080
```
This starts Postgres and the app, applies the migrations, loads the 43,055 temples on first start, and enables the dummy admin button (`DEV_LINKS=1`, local only). Without Docker: `npm install`, start any Postgres, set `DATABASE_URL`, then `npm run migrate && npm run import && npm start`.

## Deploy on Render
1. Push this folder to a Git repository.
2. Render dashboard → **New → Blueprint** → pick the repo. `render.yaml` creates a web service (this Dockerfile) and a Postgres database and wires `DATABASE_URL` for you.
3. Set the variables Render asks for:

| Variable | Value |
|---|---|
| `BASE_URL` | your public URL, e.g. `https://global-temple-directory.onrender.com` (used in sign-in links) |
| `ALLOW_DEV_ADMIN` | optional, `1` shows the dummy admin button. **Any visitor could become admin**, so use it only on a private or demo site. Unset = nobody is admin |
| `PGSSL` | `1` only if your database requires SSL (public connection strings usually do; Render's internal URL does not) |

4. **Email verification is switched off for now.** Sign-in stores a name and email and does not check them, so an email proves nothing: it never grants admin, and an existing admin's email is refused. Admin is only the dummy-admin button (`ALLOW_DEV_ADMIN=1`). To re-enable verification, uncomment the marked code in `server/routes/auth.js` (it needs `MAIL_API_KEY`, `MAIL_FROM`, `ADMIN_EMAILS`).
5. First start runs the migrations and imports the temples (a minute or two). Check `/api/health`.
6. If you enabled the dummy admin, sign in with it, open **Admin**, and decide whether **Require approval** is on (default off = changes go live at once).

Free plans change over time and free databases may expire or sleep; check Render's current terms and use a paid plan for anything you rely on.

## Backups
- Full: `pg_dump "$DATABASE_URL" -Fc > backup.dump` (restore with `pg_restore -d "$NEW_DATABASE_URL" backup.dump`).
- Portable files: `npm run export` writes `exports/temples.ndjson` and `exports/community.json`; the same data is downloadable from `/api/export/...` while the site runs.

## Leaving Render (or any host)
1. `pg_dump` the database. 2. Create a Postgres anywhere (Neon, Supabase, Fly, a VPS, your own server). 3. Restore the dump. 4. Deploy the same image (or `node server/scripts/start.js`) with the new `DATABASE_URL`. No code changes.

To rebuild from nothing (no dump): `npm run migrate && npm run import` recreates the temples; community data lives only in the database, so keep backups.

## Static hosting (no server)
If `/api/health` does not answer, the front-end falls back to a browser-only demo mode (ratings, sign-in and edits stay in that browser and are not shared). Useful for previews, not for real use.

## Known limits
- Open ratings with no sign-in cannot be made airtight: per-browser cookies, honeypot and rate limits reduce abuse but a determined person can clear cookies. Sign-in-only voting or CAPTCHA is the upgrade path.
- Rate limiting is in memory (one process). Running several instances needs a shared store such as Redis.
- Email verification is off, so volunteer identities are unverified. Real email delivery (when re-enabled) and a live Render deployment were **not** tested (they need your accounts and keys).
