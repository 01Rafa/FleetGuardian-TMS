# Environments, CI and Secrets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Development can no longer touch production data, every push runs the tests, and secrets are out of leak-prone places and rotated, at no extra cost.

**Architecture:** Each database stores a one-row marker (`AppEnvironment`) naming its environment. The server, the seed script and the setup script compare that marker with the process `APP_ENV` and refuse to run on a mismatch. A GitHub Actions workflow runs tests and build on every push. Secrets hygiene is a root `.gitignore`, a history scan and a rotation runbook the owner executes.

**Tech Stack:** Node 25 locally (CI uses Node 22), Express 5, Prisma 7 with PrismaPg, PostgreSQL (Supabase), GitHub Actions, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-21-environments-ci-secrets-design.md`

## Global Constraints

- Two environments only: production (the current Supabase, Railway and Vercel projects, not moved) and development (a new free Supabase project, backend on the developer's machine). No staging. No new paid services.
- `APP_ENV` is one of `development`, `staging`, `production`. It is required at boot.
- The guard fails closed: a missing marker or a mismatch stops the process before any seed or cron runs.
- Destructive scripts (`prisma/seed.js`) and `scripts/setup-db.mjs` never run with `APP_ENV=production`.
- `npm run seed` deletes every table: it must be guarded before anything else touches a shared database again.
- CI blocks on backend tests, frontend tests and the frontend build. Frontend lint and `npm audit` only warn for now (the frontend has 19 lint errors, fixed on day 12).
- Repo rules: run backend tests with `npm test` inside `backend/` (never `node --test src/`). Git needs `git -c safe.directory='*'`. Commit messages end with a blank line and `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Do not push unless the owner says so. Temporary scripts live in `backend/_*.mjs` and are deleted after use. Never read or print `.claude/settings.local.json`, `backend/.env` values or any credential.
- ES modules with explicit `.js` imports, no semicolons, single quotes.
- Steps marked **OWNER** need the owner in a dashboard. Steps that change production (migration, marker, push) need the owner's explicit OK first.

---

## File Structure

| File | Responsibility |
|---|---|
| `.gitignore` (new), `.github/workflows/ci.yml` (new), `.github/dependabot.yml` (new) | Ignore rules, CI, dependency updates |
| `backend/src/lib/env.js` | `APP_ENV` validation |
| `backend/src/lib/environment.js` (new) | Marker checks and `readMarker` |
| `backend/migrations/manual/006_environment_marker.sql` (new), `backend/prisma/schema.prisma` | Marker table |
| `backend/scripts/mark-environment.mjs`, `backend/scripts/setup-db.mjs` (new) | Mark a database, build a development database |
| `backend/prisma/seed.js` | Guard |
| `backend/src/index.js` | Boot guard |
| `backend/.env.example` | New variable |
| `docs/entornos.md` (new) | Runbook |

---

### Task 1: `.gitignore`, CI and Dependabot

**Files:**
- Create: `.gitignore`, `.github/workflows/ci.yml`, `.github/dependabot.yml`

- [ ] **Step 1: Create the root `.gitignore`**

```gitignore
node_modules/
.env
.env.*
!.env.example
!frontend/.env.production
.claude/settings.local.json
backend/_*.mjs
```

- [ ] **Step 2: Check it does not hide anything already tracked**

Run (repo root): `git -c safe.directory='*' ls-files -ci --exclude-standard`
Expected: no output. If a tracked file is listed, fix the ignore rule (a tracked file must never match).

Run (repo root): `git -c safe.directory='*' check-ignore -v .claude/settings.local.json backend/.env backend/_apply_sql.mjs`
Expected: all three are reported as ignored.

- [ ] **Step 3: Create the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    env:
      # Only used by `prisma generate` in postinstall; the tests never open a connection.
      DATABASE_URL: postgresql://ci:ci@localhost:5432/ci
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm test

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npx vite build
      - name: Lint (warning only until day 12 fixes the existing errors)
        run: npm run lint
        continue-on-error: true

  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Audit backend (warning only for now)
        working-directory: backend
        run: npm audit --omit=dev --audit-level=high
        continue-on-error: true
      - name: Audit frontend (warning only for now)
        working-directory: frontend
        run: npm audit --omit=dev --audit-level=high
        continue-on-error: true
```

- [ ] **Step 4: Create the Dependabot config**

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /backend
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]
  - package-ecosystem: npm
    directory: /frontend
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

- [ ] **Step 5: Validate the YAML**

Run (repo root): `python -c "import yaml,sys; [yaml.safe_load(open(f)) for f in ('.github/workflows/ci.yml','.github/dependabot.yml')]; print('yaml-ok')"`
Expected: `yaml-ok`. If PyYAML is missing: `pip install pyyaml` and rerun.

- [ ] **Step 6: Run the same commands CI runs, locally**

Run (in `backend/`): `npm test`
Expected: all pass.
Run (in `frontend/`): `npm test && npx vite build`
Expected: all pass and "built in ...".

- [ ] **Step 7: Commit**

```bash
git -c safe.directory='*' add .gitignore .github/workflows/ci.yml .github/dependabot.yml
git -c safe.directory='*' commit -q -F - <<'EOF'
Add CI workflow, Dependabot config and root .gitignore

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: `APP_ENV` validation

**Files:**
- Modify: `backend/src/lib/env.js`, `backend/src/lib/env.test.js`, `backend/.env.example`

**Interfaces:**
- Produces: `checkEnv(env)` now returns `{ missing, warnings, invalid }`; `invalid` holds messages such as `APP_ENV must be one of development, staging, production (got "x")`. `validateEnv` throws on `missing` or `invalid`.

- [ ] **Step 1: Update and extend the tests**

In `backend/src/lib/env.test.js` change the `full` constant to:

```js
const full = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'a', JWT_REFRESH_SECRET: 'b', APP_ENV: 'development', ORS_API_KEY: 'c', GEMINI_API_KEY: 'd' }
```

Change the first test's expectation to:

```js
  assert.deepEqual(checkEnv(full), { missing: [], warnings: [], invalid: [] })
```

Change the test "validateEnv does not throw when only optional variables are missing" to include APP_ENV:

```js
  assert.doesNotThrow(() => validateEnv({ DATABASE_URL: 'x', JWT_SECRET: 'a', JWT_REFRESH_SECRET: 'b', APP_ENV: 'production' }))
```

Append:

```js
test('APP_ENV is required', () => {
  const { APP_ENV, ...rest } = full
  assert.deepEqual(checkEnv(rest).missing, ['APP_ENV'])
  assert.throws(() => validateEnv(rest), /APP_ENV/)
})

test('APP_ENV must be development, staging or production', () => {
  assert.deepEqual(checkEnv({ ...full, APP_ENV: 'prod' }).invalid, ['APP_ENV must be one of development, staging, production (got "prod")'])
  assert.throws(() => validateEnv({ ...full, APP_ENV: 'prod' }), /APP_ENV must be one of/)
  for (const ok of ['development', 'staging', 'production']) assert.doesNotThrow(() => validateEnv({ ...full, APP_ENV: ok }))
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `backend/`): `node --test src/lib/env.test.js`
Expected: FAIL (`invalid` is missing, `APP_ENV` is not required yet).

- [ ] **Step 3: Implement**

Replace `backend/src/lib/env.js` with:

```js
export const APP_ENVS = ['development', 'staging', 'production']

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'APP_ENV']
// The app boots without these, but the feature that uses them fails at request time.
const OPTIONAL = ['ORS_API_KEY', 'GEMINI_API_KEY']

const isSet = v => typeof v === 'string' && v.trim() !== ''

export function checkEnv(env = process.env) {
  const invalid = []
  if (isSet(env.APP_ENV) && !APP_ENVS.includes(env.APP_ENV)) {
    invalid.push(`APP_ENV must be one of ${APP_ENVS.join(', ')} (got "${env.APP_ENV}")`)
  }
  return {
    missing: REQUIRED.filter(k => !isSet(env[k])),
    warnings: OPTIONAL.filter(k => !isSet(env[k])),
    invalid,
  }
}

// Call once at boot: a missing or invalid variable stops the process with a clear message
// instead of failing on the first login.
export function validateEnv(env = process.env) {
  const { missing, warnings, invalid } = checkEnv(env)
  if (warnings.length) console.warn(`[env] optional variables not set (related features will fail): ${warnings.join(', ')}`)
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  if (invalid.length) throw new Error(invalid.join('; '))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (in `backend/`): `node --test src/lib/env.test.js`
Expected: all pass.

- [ ] **Step 5: Document the variable**

Read `backend/.env.example` and add, next to the other required variables (with the same comment style):

```
# Which environment this process is: development, staging or production.
# The database must carry the same marker (see docs/entornos.md), otherwise the server refuses to start.
APP_ENV=development
```

- [ ] **Step 6: Commit**

```bash
git -c safe.directory='*' add backend/src/lib/env.js backend/src/lib/env.test.js backend/.env.example
git -c safe.directory='*' commit -q -F - <<'EOF'
Require APP_ENV at boot

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

NOTE: do NOT push this commit before Railway has `APP_ENV=production` (Task 8). Without it the production server refuses to boot.

---

### Task 3: Environment marker checks

**Files:**
- Create: `backend/src/lib/environment.js`
- Test: `backend/src/lib/environment.test.js`

**Interfaces:**
- Consumes: `APP_ENVS` is defined in `env.js` (Task 2); this module only takes plain strings.
- Produces:
  - `checkEnvironmentMarker({ appEnv, marker }): { ok: true } | { ok: false, message }`
  - `checkDestructiveAllowed({ appEnv, marker })` same shape
  - `checkSetupAllowed({ appEnv, marker, hasData })` same shape
  - `readMarker(prisma): Promise<string | null>` (`null` when the table or row is missing; rethrows other errors)
  - `assertDatabaseEnvironment(prisma, appEnv): Promise<void>` (throws `Error(message)`)

- [ ] **Step 1: Write the failing tests**

Create `backend/src/lib/environment.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { checkEnvironmentMarker, checkDestructiveAllowed, checkSetupAllowed, readMarker, assertDatabaseEnvironment } from './environment.js'

test('the server starts when the database marker equals APP_ENV', () => {
  assert.deepEqual(checkEnvironmentMarker({ appEnv: 'production', marker: 'production' }), { ok: true })
  assert.deepEqual(checkEnvironmentMarker({ appEnv: 'development', marker: 'development' }), { ok: true })
})

test('a development server pointed at the production database is refused, naming both values', () => {
  const res = checkEnvironmentMarker({ appEnv: 'development', marker: 'production' })
  assert.equal(res.ok, false)
  assert.match(res.message, /APP_ENV is "development"/)
  assert.match(res.message, /marked "production"/)
})

test('a database without a marker is refused and the message says how to mark it', () => {
  const res = checkEnvironmentMarker({ appEnv: 'production', marker: null })
  assert.equal(res.ok, false)
  assert.match(res.message, /no environment marker/)
  assert.match(res.message, /mark-environment\.mjs production/)
})

test('destructive scripts never run with APP_ENV=production, whatever the marker says', () => {
  assert.equal(checkDestructiveAllowed({ appEnv: 'production', marker: 'production' }).ok, false)
})

test('destructive scripts need the marker to match a non-production environment', () => {
  assert.equal(checkDestructiveAllowed({ appEnv: 'development', marker: 'development' }).ok, true)
  assert.equal(checkDestructiveAllowed({ appEnv: 'development', marker: 'production' }).ok, false)
  assert.equal(checkDestructiveAllowed({ appEnv: 'development', marker: null }).ok, false)
})

test('setup is refused for production and for a database marked as another environment', () => {
  assert.equal(checkSetupAllowed({ appEnv: 'production', marker: null, hasData: false }).ok, false)
  assert.equal(checkSetupAllowed({ appEnv: 'development', marker: 'production', hasData: true }).ok, false)
})

test('setup is refused on a database that has data but no marker', () => {
  const res = checkSetupAllowed({ appEnv: 'development', marker: null, hasData: true })
  assert.equal(res.ok, false)
  assert.match(res.message, /has data but no environment marker/)
})

test('setup is allowed on an empty database or one already marked with the same environment', () => {
  assert.equal(checkSetupAllowed({ appEnv: 'development', marker: null, hasData: false }).ok, true)
  assert.equal(checkSetupAllowed({ appEnv: 'development', marker: 'development', hasData: true }).ok, true)
})

const fakePrisma = handler => ({ $queryRaw: async () => handler() })

test('readMarker returns the name stored in the database', async () => {
  assert.equal(await readMarker(fakePrisma(() => [{ name: 'development' }])), 'development')
})

test('readMarker returns null for an empty table or a missing table', async () => {
  assert.equal(await readMarker(fakePrisma(() => [])), null)
  assert.equal(await readMarker(fakePrisma(() => { throw new Error('relation "AppEnvironment" does not exist') })), null)
})

test('readMarker does not hide a real database error', async () => {
  await assert.rejects(readMarker(fakePrisma(() => { throw new Error('connect ECONNREFUSED') })), /ECONNREFUSED/)
})

test('assertDatabaseEnvironment resolves on a match and throws the message on a mismatch', async () => {
  await assertDatabaseEnvironment(fakePrisma(() => [{ name: 'production' }]), 'production')
  await assert.rejects(assertDatabaseEnvironment(fakePrisma(() => [{ name: 'production' }]), 'development'), /marked "production"/)
  await assert.rejects(assertDatabaseEnvironment(fakePrisma(() => []), 'production'), /no environment marker/)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `backend/`): `node --test src/lib/environment.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/lib/environment.js`:

```js
// Each database stores which environment it is ("AppEnvironment", one row). The process says which one it
// wants to be with APP_ENV. Comparing the two is more reliable than matching hostnames.

export function checkEnvironmentMarker({ appEnv, marker }) {
  if (!marker) {
    return { ok: false, message: `This database has no environment marker. If it really is the ${appEnv} database, run: node scripts/mark-environment.mjs ${appEnv}` }
  }
  if (marker !== appEnv) {
    return { ok: false, message: `Refusing to run: APP_ENV is "${appEnv}" but this database is marked "${marker}". Point DATABASE_URL at the ${appEnv} database.` }
  }
  return { ok: true }
}

// For scripts that delete data (prisma/seed.js).
export function checkDestructiveAllowed({ appEnv, marker }) {
  if (appEnv === 'production') {
    return { ok: false, message: 'Refusing to run: this script deletes data and never runs with APP_ENV=production.' }
  }
  return checkEnvironmentMarker({ appEnv, marker })
}

// For scripts/setup-db.mjs, which builds a database from scratch. A fresh database has no marker yet.
export function checkSetupAllowed({ appEnv, marker, hasData }) {
  if (appEnv === 'production') {
    return { ok: false, message: 'Refusing to run: setup-db never runs with APP_ENV=production.' }
  }
  if (marker && marker !== appEnv) {
    return { ok: false, message: `Refusing to run: this database is marked "${marker}" but APP_ENV is "${appEnv}".` }
  }
  if (!marker && hasData) {
    return { ok: false, message: 'Refusing to run: this database has data but no environment marker, so it could be production.' }
  }
  return { ok: true }
}

// null when the marker table or row does not exist yet; any other database error is rethrown.
export async function readMarker(prisma) {
  try {
    const rows = await prisma.$queryRaw`SELECT "name" FROM "AppEnvironment" WHERE "id" = 1`
    return rows[0]?.name ?? null
  } catch (err) {
    if (/does not exist/i.test(String(err?.message))) return null
    throw err
  }
}

export async function assertDatabaseEnvironment(prisma, appEnv) {
  const result = checkEnvironmentMarker({ appEnv, marker: await readMarker(prisma) })
  if (!result.ok) throw new Error(result.message)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (in `backend/`): `node --test src/lib/environment.test.js`
Expected: 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/lib/environment.js backend/src/lib/environment.test.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Add database environment marker checks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Marker table, mark script and setup script

**Files:**
- Create: `backend/migrations/manual/006_environment_marker.sql`, `backend/scripts/mark-environment.mjs`, `backend/scripts/setup-db.mjs`
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: `APP_ENVS` (Task 2), `readMarker`, `checkSetupAllowed` (Task 3), `prisma` from `backend/src/lib/prisma.js`.
- Produces: table `AppEnvironment`, Prisma model `AppEnvironment`, CLI `node scripts/mark-environment.mjs <name> [--force]`, CLI `node scripts/setup-db.mjs`.

The scripts are thin wrappers around tested functions and touch real databases, so they are verified in Task 8, not with unit tests.

- [ ] **Step 1: Migration**

Create `backend/migrations/manual/006_environment_marker.sql`:

```sql
-- Migration: 006_environment_marker
-- Feature: every database records which environment it is (production, staging, development).
-- Additive and idempotent. Creates the table only, it never inserts a row:
-- the row is written on purpose with `node scripts/mark-environment.mjs <name>`.

CREATE TABLE IF NOT EXISTS "AppEnvironment" (
  "id"   INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "name" TEXT NOT NULL,
  CONSTRAINT "AppEnvironment_single_row" CHECK ("id" = 1)
);
```

- [ ] **Step 2: Declare the model so `prisma db push` never drops the table**

Append to `backend/prisma/schema.prisma`:

```prisma
// One row that says which environment this database is. Created by migration 006, written by scripts/mark-environment.mjs.
model AppEnvironment {
  id   Int    @id @default(1)
  name String
}
```

Run (in `backend/`): `npx prisma generate && npx prisma validate`
Expected: "Generated Prisma Client" and "is valid".

- [ ] **Step 3: The mark script**

Create `backend/scripts/mark-environment.mjs`:

```js
import 'dotenv/config'
import prisma from '../src/lib/prisma.js'
import { APP_ENVS } from '../src/lib/env.js'
import { readMarker } from '../src/lib/environment.js'

const [name, ...flags] = process.argv.slice(2)
if (!APP_ENVS.includes(name)) {
  console.error(`Usage: node scripts/mark-environment.mjs <${APP_ENVS.join('|')}> [--force]`)
  process.exit(1)
}

try {
  const current = await readMarker(prisma)
  if (current && current !== name && !flags.includes('--force')) {
    console.error(`This database is already marked "${current}". Use --force only if you are sure.`)
    process.exit(1)
  }
  await prisma.$executeRaw`INSERT INTO "AppEnvironment" ("id", "name") VALUES (1, ${name}) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name"`
  console.log(`Database marked as ${name}`)
} catch (err) {
  if (/does not exist/i.test(String(err?.message))) {
    console.error('The AppEnvironment table does not exist. Apply backend/migrations/manual/006_environment_marker.sql first.')
    process.exit(1)
  }
  throw err
} finally {
  await prisma.$disconnect()
}
```

- [ ] **Step 4: The setup script**

Create `backend/scripts/setup-db.mjs`:

```js
import 'dotenv/config'
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import pg from 'pg'
import { APP_ENVS } from '../src/lib/env.js'
import { checkSetupAllowed } from '../src/lib/environment.js'

const appEnv = process.env.APP_ENV
if (!APP_ENVS.includes(appEnv)) {
  console.error(`APP_ENV must be one of ${APP_ENVS.join(', ')}`)
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const exists = async table => (await client.query('SELECT to_regclass($1) AS t', [`"${table}"`])).rows[0].t !== null
const marker = (await exists('AppEnvironment')) ? ((await client.query('SELECT "name" FROM "AppEnvironment" WHERE "id" = 1')).rows[0]?.name ?? null) : null
const hasData = (await exists('Usuario')) && Number((await client.query('SELECT count(*) AS n FROM "Usuario"')).rows[0].n) > 0

const verdict = checkSetupAllowed({ appEnv, marker, hasData })
if (!verdict.ok) {
  console.error(verdict.message)
  await client.end()
  process.exit(1)
}

console.log(`[setup] building the ${appEnv} database`)
execSync('npx prisma db push --skip-generate', { stdio: 'inherit' })

const dir = new URL('../migrations/manual/', import.meta.url)
for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  await client.query(readFileSync(new URL(file, dir), 'utf8'))
  console.log(`[setup] applied ${file}`)
}
await client.query('INSERT INTO "AppEnvironment" ("id", "name") VALUES (1, $1) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name"', [appEnv])
await client.end()
console.log(`[setup] database marked as ${appEnv}`)

console.log('[setup] loading demo data')
execSync('node prisma/seed.js', { stdio: 'inherit' })
console.log('[setup] done. Demo login: admin@demo.com / demo1234 (development only)')
```

- [ ] **Step 5: Syntax check and commit**

Run (in `backend/`): `node --check scripts/mark-environment.mjs && node --check scripts/setup-db.mjs && npm test`
Expected: no errors and the whole suite passes.

```bash
git -c safe.directory='*' add backend/migrations/manual/006_environment_marker.sql backend/prisma/schema.prisma backend/scripts/mark-environment.mjs backend/scripts/setup-db.mjs
git -c safe.directory='*' commit -q -F - <<'EOF'
Add environment marker table and scripts to mark and set up a database

Migration 006 must be applied to production, then marked, before deploying the guard.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Guards on the server and on the seed

**Files:**
- Modify: `backend/src/index.js`, `backend/prisma/seed.js`

**Interfaces:**
- Consumes: `assertDatabaseEnvironment`, `readMarker`, `checkDestructiveAllowed` (Task 3), `validateEnv` (Task 2).

- [ ] **Step 1: Server boot guard**

In `backend/src/index.js` add to the imports:

```js
import prisma from './lib/prisma.js'
import { assertDatabaseEnvironment } from './lib/environment.js'
```

Replace:

```js
const PORT = process.env.PORT ?? 3000
runSeed().catch(err => console.error('[seed] Failed to seed cities:', err))
```

with:

```js
// Stop before the seed or the cron touch anything if this database is not the environment we think it is.
try {
  await assertDatabaseEnvironment(prisma, process.env.APP_ENV)
  console.log(`[env] APP_ENV=${process.env.APP_ENV}, the database marker matches`)
} catch (err) {
  console.error(`[env] ${err.message}`)
  process.exit(1)
}

const PORT = process.env.PORT ?? 3000
runSeed().catch(err => console.error('[seed] Failed to seed cities:', err))
```

- [ ] **Step 2: Seed guard**

Read `backend/prisma/seed.js` fully first. Add to the imports:

```js
import { readMarker, checkDestructiveAllowed } from '../src/lib/environment.js'
```

Make the first statement of `main()`:

```js
  const verdict = checkDestructiveAllowed({ appEnv: process.env.APP_ENV, marker: await readMarker(prisma) })
  if (!verdict.ok) throw new Error(verdict.message)
```

(That is before the first `deleteMany`.) Keep the existing error handling of the file at the end (its `.catch` must print the error and exit non-zero; if it does not, add `process.exit(1)` in the catch).

- [ ] **Step 3: Prove both guards refuse, without changing any data**

The local `backend/.env` still points at production here and has no `APP_ENV`. Run (in `backend/`, only after Task 8 step 2 marked production; before that both refuse for "no marker", which is also a refusal):

```bash
APP_ENV=development node prisma/seed.js
```
Expected: the process ends with an error message from `checkDestructiveAllowed` and NO rows are deleted.

```bash
APP_ENV=production node prisma/seed.js
```
Expected: `Refusing to run: this script deletes data and never runs with APP_ENV=production.`

- [ ] **Step 4: Full test run and commit**

Run (in `backend/`): `node --check src/index.js && node --check prisma/seed.js && npm test`
Expected: no errors, all tests pass.

```bash
git -c safe.directory='*' add backend/src/index.js backend/prisma/seed.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Refuse to start or seed against a database of another environment

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Dependency vulnerabilities

**Files:**
- Modify: `backend/package.json`, `backend/package-lock.json`, `frontend/package.json`, `frontend/package-lock.json`

- [ ] **Step 1: Record the starting point**

Run (in `backend/` and `frontend/`): `npm audit --omit=dev 2>&1 | tail -6`
Note the counts.

- [ ] **Step 2: Apply the non-breaking fixes**

Run (in `backend/`): `npm audit fix`
Run (in `frontend/`): `npm audit fix`
Never use `--force`.

- [ ] **Step 3: Check nothing broke**

Run (in `backend/`): `npm test`
Run (in `frontend/`): `npm test && npx vite build`
Expected: all pass. If something breaks, `git checkout -- package.json package-lock.json` in that folder and record the package that caused it instead of forcing it.

- [ ] **Step 4: List what remains and why**

Run (in each folder): `npm audit --omit=dev 2>&1 | tail -30`
Write each remaining advisory with its reason (needs a major upgrade, no fix available, dev-only) into the "Vulnerabilidades pendientes" section of `docs/entornos.md` in Task 7.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json
git -c safe.directory='*' commit -q -F - <<'EOF'
Apply non-breaking npm audit fixes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Documentation

**Files:**
- Create: `docs/entornos.md`
- Modify: `docs/superpowers/specs/2026-09-20-forgot-password-design.md`, `docs/superpowers/plans/2026-09-20-forgot-password.md` (revision notes), `docs/plan-mejoras-tms.html` (untracked)

- [ ] **Step 1: Write `docs/entornos.md`** (Spanish, it is for the owner) with these sections, each with the concrete commands and values from this plan:

  1. **Entornos:** production and development, what each one is, where it runs. Staging: not created; how to add it (new Supabase project, `APP_ENV=staging`, `node scripts/setup-db.mjs`, Railway environment, Vercel preview variable, `ALLOWED_ORIGINS`), and that it costs money.
  2. **Variables por entorno:** a table of `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `APP_ENV`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `ORS_API_KEY`, `GEMINI_API_KEY`, `PORT` for production and development. Development uses its own JWT secrets and `ALLOWED_ORIGINS=http://localhost:5175`.
  3. **Crear la base de desarrollo:** create a free Supabase project, fill `backend/.env`, run `node scripts/setup-db.mjs`, start with `npm run dev`; demo login `admin@demo.com` / `demo1234`.
  4. **La guardia:** how the marker works, each error message and what to do (mismatch, missing marker, `mark-environment.mjs`, `--force`), and the known bypass (copying the production URL and also writing `APP_ENV=production`).
  5. **Scripts peligrosos:** `npm run seed` deletes everything and now refuses production.
  6. **Rotación de claves:** the runbook from Task 9 in order, with the expected downtime of each step.
  7. **Vulnerabilidades pendientes:** the list from Task 6 step 4.
  8. **CI:** what runs, what blocks, and the two GitHub/Railway settings the owner turns on (required checks before merging; Railway "Wait for CI").

- [ ] **Step 2: Fix the migration number in the forgot-password docs**

In both forgot-password revision notes replace `006_password_reset.sql` with `007_password_reset.sql` and the sentence "(005 is the sessions table)" with "(005 is the sessions table, 006 the environment marker)".

- [ ] **Step 3: Annotate day 3 in the HTML plan**

In `docs/plan-mejoras-tms.html` replace the day 3 task strings, keeping quotes and commas, only after the matching work is verified:

- `'Crear proyectos separados en Supabase y Railway para desarrollo, staging y producción, cada uno con su archivo de variables'` becomes `'Entornos separados: producción y desarrollo (Supabase de desarrollo gratuito, sin staging por ahora; se documenta cómo añadirlo) con su archivo de variables (hecho el 21 sept)'`
- `'Proteger producción: el servidor se niega a arrancar contra la BD de producción si NODE_ENV no es production'` becomes `'Proteger producción: cada base de datos lleva una marca y el servidor y el seed se niegan a correr si no coincide con APP_ENV (hecho el 21 sept)'`
- `'Rotar todas las claves (contraseña de Supabase, Gemini, OpenRouteService, JWT) y agregar .claude/settings.local.json al .gitignore'` gets `(hecho el 21 sept)` appended once Task 9 is finished.
- `'GitHub Actions: tests del backend y del frontend, lint y build en cada push, más npm audit'` becomes `'GitHub Actions: tests del backend y del frontend, lint y build en cada push, más npm audit (hecho el 21 sept; lint y audit solo avisan hasta el día 12)'`
- `'Resolver las 57 alertas de Dependabot que pueda y dejar anotado lo que no'` gets `(hecho el 21 sept, lo pendiente está en docs/entornos.md)` appended.

Run: `node -e "const h=require('fs').readFileSync('docs/plan-mejoras-tms.html','utf8');const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');require('fs').writeFileSync(process.env.TEMP+'/plan_check.js',s)" && node --check "$TEMP/plan_check.js" && echo js-ok`
Expected: `js-ok`.

- [ ] **Step 4: Commit the tracked docs**

```bash
git -c safe.directory='*' add docs/entornos.md docs/superpowers/specs/2026-09-20-forgot-password-design.md docs/superpowers/plans/2026-09-20-forgot-password.md
git -c safe.directory='*' commit -q -F - <<'EOF'
Document environments, guard, CI and key rotation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Roll out and set up development

**Files:**
- Temporary, never committed: `backend/_apply_sql.mjs` (delete after use).

**Interfaces:**
- Consumes: everything above. The local `backend/.env` points at PRODUCTION until step 6, on purpose.

Order matters. The guard fails closed, so production must be ready before the code that checks it is deployed.

- [ ] **Step 1: OWNER sets `APP_ENV=production` in Railway**

Give the owner this prompt for the Railway assistant: "In the backend service of my Fleet Guardian project add the variable APP_ENV with the value production. Do not change any other variable. Then tell me the deployment status." Wait for confirmation. Harmless before the guard exists (the server ignores it).

- [ ] **Step 2: Apply migration 006 to production and mark it (with the owner's OK)**

Create `backend/_apply_sql.mjs`:

```js
import 'dotenv/config'
import pg from 'pg'
import { readFileSync } from 'node:fs'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
await client.query(readFileSync('migrations/manual/006_environment_marker.sql', 'utf8'))
const tbl = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_name = 'AppEnvironment'`)
console.log('table AppEnvironment:', tbl.rows.length === 1 ? 'ok' : 'MISSING')
await client.end()
```

Run (in `backend/`): `node _apply_sql.mjs` (twice, it is idempotent), then `rm _apply_sql.mjs`.
Expected: `table AppEnvironment: ok` both times.

Run (in `backend/`): `node scripts/mark-environment.mjs production`
Expected: `Database marked as production`.

- [ ] **Step 3: Prove the guard on the real boot path (read-only)**

Run (in `backend/`, the .env still points at production): `APP_ENV=development node src/index.js`
Expected: `[env] Refusing to run: APP_ENV is "development" but this database is marked "production"...` and the process exits with code 1 before listening. No port is opened and nothing is seeded.

Run (in `backend/`): `APP_ENV=development node prisma/seed.js`
Expected: refusal from `checkDestructiveAllowed`, no rows deleted.

- [ ] **Step 4: Push (with the owner's OK) and watch CI**

Run (repo root): `git -c safe.directory='*' push origin master`

Then check the first CI run. Try `curl -s "https://api.github.com/repos/01Rafa/FleetGuardian-TMS/actions/runs?per_page=1"` and read `workflow_runs[0].status` and `conclusion`. If the repository is private and the API answers 404, ask the owner to open the Actions tab and report the result.
Expected: `backend` and `frontend` jobs green. `audit` and the lint step may show warnings. If a blocking job is red, stop and fix it (superpowers:systematic-debugging).

- [ ] **Step 5: Check production booted with the guard**

Wait until Railway deployed (poll `https://fleetguardian-tms-production.up.railway.app/api/health` until 200 after the push). Then:

Run: `curl -s -X POST https://fleetguardian-tms-production.up.railway.app/api/auth/login -H "Content-Type: application/json" -d '{"email":"nadie.dia3@example.com","password":"x"}'`
Expected: `{"error":"Invalid credentials"}` (proves the database is reachable). Ask the owner to look at the Railway deploy log and confirm the line `[env] APP_ENV=production, the database marker matches`. Nothing is created in the database in this step.

If production does not come up: the fastest recovery is the owner setting the missing variable or marking the database (`node scripts/mark-environment.mjs production` from `backend/` with the production `.env`), not reverting the code.

- [ ] **Step 6: OWNER creates the development database**

Ask the owner to: create a new FREE Supabase project (name `fleet-guardian-dev`; if the account already has 2 active projects, stop and decide together: do not upgrade the plan), copy the pooled connection string (`DATABASE_URL`) and the direct connection string (`DIRECT_URL`), and replace `backend/.env` with:

```
DATABASE_URL=<dev pooled connection string>
DIRECT_URL=<dev direct connection string>
APP_ENV=development
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))">
JWT_REFRESH_SECRET=<generate the same way, a different value>
PORT=3000
FRONTEND_URL=http://localhost:5175
ALLOWED_ORIGINS=http://localhost:5175,http://localhost:5173
ORS_API_KEY=<same key as production>
GEMINI_API_KEY=<same key as production>
```

They fill it in themselves. The assistant never sees or prints the values.

- [ ] **Step 7: Build and run the development environment**

Run (in `backend/`): `node scripts/setup-db.mjs`
Expected: `[setup] building the development database`, each SQL file applied, `database marked as development`, demo data loaded, `Demo login: admin@demo.com / demo1234`.

Run (in `backend/`): `node scripts/setup-db.mjs` again.
Expected: it works again without errors on the now marked database... except the demo seed, which is idempotent by design (it wipes and reloads the development data).

Run (in `backend/`): `npm run dev` in the background, then `curl -s http://localhost:3000/api/health`.
Expected: `{"status":"ok"}` and the log line `[env] APP_ENV=development, the database marker matches`. Stop the server afterwards.

- [ ] **Step 8: Prove development cannot reach production**

Ask the owner to confirm (do not print it) that `backend/.env` no longer contains the production connection strings. From now on the only copy of the production database credentials is in Railway (and Supabase).

---

### Task 9: Secrets hygiene and key rotation

**Files:** none in the repo (dashboards and local `backend/.env`).

- [ ] **Step 1: Scan the git history for committed secrets**

Run (repo root): `git -c safe.directory='*' log --all -p --no-color | grep -nE "postgres(ql)?://[^:@[:space:]]+:[^@[:space:]]+@|JWT_(REFRESH_)?SECRET=.{8,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}" | sed -E 's/(=|:)[^ ]{6,}/\1<hidden>/g' | cut -c1-160 | head -40`
Expected: the lines shown are only placeholders from `.env.example` or docs. Report each real hit as "file, line, kind of secret" without printing the value. A real hit means that secret must be rotated in step 4 (it is anyway).

- [ ] **Step 2: OWNER removes credentials from `.claude/settings.local.json`**

The file is now ignored by git. Ask the owner to open it and delete every permission entry that contains a password, key or token (recorded from earlier approved commands). The assistant does not read or edit this file unless the owner explicitly asks.

- [ ] **Step 3: Generate the new JWT secrets**

Ask the owner to run twice in their own terminal: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and keep the two values for step 4. Do not paste them in the chat.

- [ ] **Step 4: OWNER rotates, in this order** (announce a short maintenance window; users must log in again at the end)

  1. **JWT:** in Railway set `JWT_SECRET` and `JWT_REFRESH_SECRET` to the two new values. Wait for the redeploy.
  2. **Gemini:** in Google AI Studio create a new key, put it in Railway `GEMINI_API_KEY` and in the local `backend/.env`, then delete the old key.
  3. **OpenRouteService:** in the ORS dashboard create a new token, put it in Railway `ORS_API_KEY` and local `.env`, then revoke the old one.
  4. **Supabase database password (production project):** Settings, Database, reset the password; immediately update `DATABASE_URL` and `DIRECT_URL` in Railway (about 10 minutes of possible downtime). The local `.env` points at development now and is not affected.
  5. **The admin password** the owner shared earlier in the chat: change it from the app after logging in again.

- [ ] **Step 5: Verify after every rotation and at the end**

Run: `curl -s https://fleetguardian-tms-production.up.railway.app/api/health` then the bogus login from Task 8 step 5.
Expected: `{"status":"ok"}` and `{"error":"Invalid credentials"}` after each step. If a step returns errors, the value in Railway is wrong: fix it before continuing. At the end ask the owner to log in from the browser, open a page that calls the routing service (creating a trip with an origin and destination) and confirm the miles appear.

- [ ] **Step 6: Record the outcome**

Annotate the rotation task in `docs/plan-mejoras-tms.html` (see Task 7 step 3) and update the project memory file `tms-day1-security-progress.md`: day 3 finished, environments separated with the marker guard, CI running, keys rotated, staging not created (cost), what is still open.

---

## Self-Review

**Spec coverage:** environment marker table, migration 006 and the `AppEnvironment` model (Tasks 3, 4); required `APP_ENV` (Task 2); pure checks, `readMarker` and `assertDatabaseEnvironment` (Task 3); `mark-environment.mjs` and `setup-db.mjs` with the seed and the refusal for production (Task 4); boot guard before seed and cron, and the seed guard (Task 5); CI, Dependabot and `.gitignore` (Task 1); `npm audit fix` and the list of what remains (Tasks 6 and 7); documentation, HTML annotation and the 006 to 007 renumbering (Task 7); rollout order, production marking, development environment, proof that dev cannot reach production (Task 8); history scan, settings cleanup and rotation in the spec's order (Task 9). Staging and lint fixes are out of scope as specified.

**Placeholders:** the connection strings and keys in Task 8 step 6 are values the owner fills in on purpose; everything else is concrete.

**Types:** `APP_ENVS`, `checkEnv`, `validateEnv`, `checkEnvironmentMarker`, `checkDestructiveAllowed`, `checkSetupAllowed`, `readMarker`, `assertDatabaseEnvironment` are defined once and used with the same names and signatures. Note `checkSetupAllowed` takes `hasData` and `setup-db.mjs` passes it.
