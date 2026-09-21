# Environments, CI and secrets: design (plan day 3)

Date: 2026-09-21
Status: design approved in chat, spec pending review

## Goal

Stop development from touching production data, run the tests on every push, and get the secrets out of places where they can leak and rotate them. Covers day 3 of `docs/plan-mejoras-tms.html`.

## Decisions taken

- **Two environments now: production and development. No staging yet** (Supabase free tier allows 2 projects and Railway extra environments cost credit). Everything is built so adding staging later is configuration only, and `docs/entornos.md` explains how.
- **Production is not moved.** The current Supabase, Railway and Vercel projects stay as production. Development is a new empty Supabase project with the backend running on the developer's machine.
- **Each database knows what it is.** A one-row table `AppEnvironment` stores `production`, `staging` or `development`. Comparing hostnames breaks whenever a URL changes, a marker inside the database does not.
- **The guard fails closed.** The server refuses to start when the marker is missing or differs from its own `APP_ENV`.
- **CI blocks on tests and build; lint and `npm audit` only warn for now.** The frontend has 19 lint errors and 3 warnings (the plan fixes them on day 12), so a blocking lint would fail from the first push.
- The forgot-password migration moves from 006 to 007 (006 is the environment marker; 004 was never created).

## Environment marker and guard

**Migration `backend/migrations/manual/006_environment_marker.sql`** (additive, idempotent), creates the table only, never inserts a row:

```sql
CREATE TABLE IF NOT EXISTS "AppEnvironment" (
  "id"   INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "name" TEXT NOT NULL,
  CONSTRAINT "AppEnvironment_single_row" CHECK ("id" = 1)
);
```

**`APP_ENV`** is a required variable (`development`, `staging` or `production`). `validateEnv` rejects a missing or unknown value. Railway production sets `production`; the local `.env` sets `development`. `NODE_ENV` keeps its current meaning.

**`backend/src/lib/environment.js`**:

- `checkEnvironmentMarker({ appEnv, marker })` is a pure function returning `{ ok: true }` or `{ ok: false, message }`. The message names both values and says how to fix it (`node scripts/mark-environment.mjs <name>` for a missing marker).
- `assertDatabaseEnvironment(prisma, appEnv)` reads the marker with a raw query and throws with that message when the check fails. A missing table counts as a missing marker.
- `index.js` calls it before `app.listen`, so a mismatch stops the process before any seed or cron runs.

**`backend/scripts/mark-environment.mjs <name>`** writes the marker row (upsert). It refuses to overwrite an existing different marker unless `--force` is given.

**`backend/scripts/setup-db.mjs`** builds a new database for development (or later staging):

1. Loads `.env`, requires `APP_ENV` and refuses `production`.
2. If an `AppEnvironment` row exists and is not this `APP_ENV`, stops.
3. Runs `prisma db push`, then every `migrations/manual/*.sql` in name order (all idempotent).
4. Writes the marker for its `APP_ENV`.
5. Seeds demo data (the trucking cities cache and one demo company with an admin whose password is random and printed once).

## CI (`.github/workflows/ci.yml`)

Runs on `push` and `pull_request`, Node 22, npm cache.

- **backend:** `npm ci`, `npm test` (the tests never connect to a database; `postinstall` runs `prisma generate` which needs no connection).
- **frontend:** `npm ci`, `npm test`, `npx vite build` (blocking); `npm run lint` with `continue-on-error: true`.
- **audit:** `npm audit --omit=dev --audit-level=high` in both projects with `continue-on-error: true`.
- `.github/dependabot.yml`: weekly npm updates for `backend/` and `frontend/`, grouped minor and patch updates.
- The owner turns on, in GitHub, the rule that requires the CI checks before merging, and in Railway the option to wait for CI before deploying.

## Secrets

- Root `.gitignore`: `node_modules/`, `.env`, `.env.*` (except `.env.example` and `frontend/.env.production`, which only holds the public API URL), `.claude/settings.local.json`, temporary scripts `backend/_*.mjs`.
- `.claude/settings.local.json` is not read or edited by the assistant. The owner removes the credentials from it (or explicitly authorizes a rewrite).
- Git history scan for committed secrets (JWT secrets, `postgres://user:password@`, API keys, long `eyJ` tokens). Any hit makes rotation mandatory for that secret and is reported without printing the value.

## Rotation (the owner works in each dashboard, in this order)

1. `JWT_SECRET` and `JWT_REFRESH_SECRET`: generated locally (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`), pasted into Railway. Ends every session.
2. Gemini and OpenRouteService keys: create the new key, update Railway and the local `.env`, delete the old key.
3. Supabase database password: reset it, then update `DATABASE_URL` and `DIRECT_URL` in Railway and in `.env` at the same time (about 10 minutes of possible downtime).
4. Verify: `/api/health`, a login with a throwaway account and one route calculation. The admin password the owner shared in chat should also be changed.

## Dependencies

`npm audit fix` without `--force` in both projects, then tests and build. What is left is written in `docs/entornos.md` with the reason (breaking major upgrade, no fix available, dev-only).

## Documentation

`docs/entornos.md`: what each environment is, its variables, how to create one with `setup-db`, how the guard works and what its errors mean, the rotation procedure, how to add staging. The day 3 tasks in `docs/plan-mejoras-tms.html` are annotated when done.

## Rollout order

1. Code, tests, CI file, `.gitignore`, audit fixes, docs: all local and committed.
2. The owner creates the development Supabase project and fills the local `.env` (`APP_ENV=development`).
3. `APP_ENV=production` is set in Railway (harmless before the guard exists).
4. With the owner's OK: apply migration 006 to production and mark it `production`; verify the marker.
5. Run `setup-db` for development and start the backend locally: it must start against development and refuse against production.
6. Push (with the owner's OK). The first CI run must be green.
7. Check the production deploy boots (health and a login with a throwaway account).
8. Secret hygiene and history scan.
9. Rotation with the owner.

## Out of scope

Staging environment, fixing the 19 lint errors, database backups (day 6), monitoring (day 6).

## Risks

- The guard fails closed: production stops if `APP_ENV` or the marker is missing. Steps 3 and 4 come before the push and step 7 checks the result.
- Rotating the database password breaks the backend if Railway and the code use different values. Done in one sitting, Railway first.
- Rotating the JWT secrets logs everybody out.
- A developer who copies production `DATABASE_URL` into `.env` but leaves `APP_ENV=production` bypasses the guard. `docs/entornos.md` says so, and `setup-db` never accepts `production`.
