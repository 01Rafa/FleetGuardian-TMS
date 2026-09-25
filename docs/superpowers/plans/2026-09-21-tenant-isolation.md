# Tenant Isolation and Per-Company Trip Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A company cannot reference, read, change or delete another company's data, and trip codes are per company, race-free and never reused.

**Architecture:** A `tenancy.js` guard verifies every foreign id a write endpoint receives. A `ContadorVuelta` table gives atomic per-company yearly counters used inside the transaction that creates the trip, with a retry on unique violations. `src/app.js` is split from `src/index.js` so an integration suite can drive the real app against the development database. Scripts for production are run by the owner with the connection in a session variable.

**Tech Stack:** Node 25, Express 5, Prisma 7 (PrismaPg), PostgreSQL, `pg`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-21-tenant-isolation-design.md`

## Global Constraints

- A foreign or nonexistent reference always answers `400` with the message `Invalid <field>` where field is one of `camionId`, `conductorPrincipalId`, `conductorSecundarioId`, `brokerId`, `tramoId`.
- Expense `tramoId` on create and update must belong to that same trip.
- Trip code format is `VLT-<year>-<n>` with the number padded to at least 3 digits. Numbers come only from the counter, are never reused, and existing codes are never rewritten.
- Unique constraint is `(empresaId, codigo)`. The global unique on `codigo` is dropped.
- Retry a trip creation at most 5 times on Prisma `P2002`.
- `cache-stats` returns only `totalRoutesCache`, `totalGeocodeCache`, `totalCacheHits` (no `topRoutes`).
- The migration is additive and idempotent, and is applied to production BEFORE the backend code is pushed.
- The integration suite refuses to run unless the database marker is `development` (same check as the seed) and is never part of `npm test` or CI.
- Production scripts take `--env <name>`, read `DATABASE_URL` from the terminal session, and abort unless the database marker equals the given name. They print counts, never ids, names or credentials.
- Repo rules: backend unit tests with `npm test` in `backend/` (never `node --test src/`). Git needs `git -c safe.directory='*'`. Commit messages end with a blank line and `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Do not push unless the owner says so. Temporary scripts in `backend/_*.mjs` are deleted after use. Never read or print credentials. ES modules with explicit `.js` imports, no semicolons, single quotes.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/lib/tenancy.js` (new) | `assertOwnedReferences` |
| `backend/src/lib/tripCode.js` (new) | `formatCodigo`, `nextCodigo`, `withTripCode` |
| `backend/migrations/manual/007_tenant_trip_codes.sql` (new), `backend/prisma/schema.prisma` | Counter table, per-company unique |
| `backend/scripts/remote-db.mjs`, `apply-sql.mjs`, `audit-tenancy.mjs`, `cleanup-test-data.mjs` (new) | Tools for any environment, used by the owner on production |
| `backend/src/app.js` (new), `backend/src/index.js` | App split from the boot sequence |
| `backend/src/controllers/vueltas.controller.js`, `tramos.controller.js`, `gastos.controller.js`, `sugerencias.controller.js`, `admin.controller.js` | Guard, codes, scoping, `topRoutes` removal |
| `backend/test/integration/tenancy.test.js` (new), `backend/package.json` | Integration suite and its script |
| `docs/entornos.md` | Scripts section |

---

### Task 1: Reference guard

**Files:**
- Create: `backend/src/lib/tenancy.js`
- Test: `backend/src/lib/tenancy.test.js`

**Interfaces:**
- Produces: `assertOwnedReferences(db, empresaId, refs)` where `refs = { camionId?, conductorPrincipalId?, conductorSecundarioId?, brokerIds?: (string|null|undefined)[], tramoIds?: (string|null|undefined)[], vueltaId? }`. Resolves when every present id belongs to `empresaId` (tramos: and to `vueltaId` when given). Throws `Error('Invalid <field>')` with `status = 400` otherwise. `null`, `undefined`, `''` and duplicates are ignored. `db` is a Prisma client or transaction.

- [ ] **Step 1: Write the failing test**

Create `backend/src/lib/tenancy.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertOwnedReferences } from './tenancy.js'

// company A owns everything prefixed a-, company B everything prefixed b-
function fakeDb() {
  const inA = id => typeof id === 'string' && id.startsWith('a-')
  const count = (ids, empresaId) => ids.filter(id => (empresaId === 'A' ? id.startsWith('a-') : id.startsWith('b-'))).length
  return {
    camion: { count: async ({ where }) => count([where.id], where.empresaId) },
    conductor: { count: async ({ where }) => count([where.id], where.empresaId) },
    broker: { count: async ({ where }) => count(where.id.in, where.empresaId) },
    tramo: {
      // tramo ids look like a-t1-v1: company a, tramo 1, trip v1
      count: async ({ where }) => where.id.in.filter(id => {
        const [company, , trip] = id.split('-')
        const okCompany = company === (where.vuelta.empresaId === 'A' ? 'a' : 'b')
        const okTrip = where.vuelta.id === undefined || `${company}-${trip}` === where.vuelta.id
        return okCompany && okTrip
      }).length,
    },
  }
}
const rejects = (promise, message) => assert.rejects(promise, err => err.status === 400 && err.message === message)

test('everything owned by the company passes', async () => {
  await assertOwnedReferences(fakeDb(), 'A', {
    camionId: 'a-c1', conductorPrincipalId: 'a-d1', conductorSecundarioId: 'a-d2',
    brokerIds: ['a-b1', 'a-b2'], tramoIds: ['a-t1-v1'],
  })
})

test('a truck of another company is rejected as camionId', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { camionId: 'b-c1' }), 'Invalid camionId')
})

test('a nonexistent truck gives the same answer as a foreign one', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { camionId: 'zzz' }), 'Invalid camionId')
})

test('each driver field is reported by name', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { conductorPrincipalId: 'b-d1' }), 'Invalid conductorPrincipalId')
  await rejects(assertOwnedReferences(fakeDb(), 'A', { conductorPrincipalId: 'a-d1', conductorSecundarioId: 'b-d2' }), 'Invalid conductorSecundarioId')
})

test('one foreign broker among several is rejected', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { brokerIds: ['a-b1', 'b-b1'] }), 'Invalid brokerId')
})

test('duplicates, null, undefined and empty strings are ignored', async () => {
  await assertOwnedReferences(fakeDb(), 'A', {
    conductorSecundarioId: '', brokerIds: ['a-b1', 'a-b1', null, undefined, ''], tramoIds: [null, undefined],
  })
  await assertOwnedReferences(fakeDb(), 'A', {})
})

test('a leg of another company is rejected as tramoId', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { tramoIds: ['b-t1-v1'] }), 'Invalid tramoId')
})

test('with vueltaId the leg must belong to that trip', async () => {
  await assertOwnedReferences(fakeDb(), 'A', { tramoIds: ['a-t1-v1'], vueltaId: 'a-v1' })
  await rejects(assertOwnedReferences(fakeDb(), 'A', { tramoIds: ['a-t1-v2'], vueltaId: 'a-v1' }), 'Invalid tramoId')
})

test('the first offending field is the one reported', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { camionId: 'b-c1', brokerIds: ['b-b1'] }), 'Invalid camionId')
})
```

- [ ] **Step 2: Run to verify it fails**

Run (in `backend/`): `node --test src/lib/tenancy.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement**

Create `backend/src/lib/tenancy.js`:

```js
const invalid = field => Object.assign(new Error(`Invalid ${field}`), { status: 400 })

const unique = ids => [...new Set(ids.filter(Boolean))]

// Every id a write endpoint receives must belong to the caller's company. A foreign id and a nonexistent
// one get the same answer, so the response never says whether an id exists in another company.
export async function assertOwnedReferences(db, empresaId, refs = {}) {
  const { camionId, conductorPrincipalId, conductorSecundarioId, brokerIds = [], tramoIds = [], vueltaId } = refs

  if (camionId && !(await db.camion.count({ where: { id: camionId, empresaId } }))) throw invalid('camionId')

  for (const [field, id] of [['conductorPrincipalId', conductorPrincipalId], ['conductorSecundarioId', conductorSecundarioId]]) {
    if (id && !(await db.conductor.count({ where: { id, empresaId } }))) throw invalid(field)
  }

  const brokers = unique(brokerIds)
  if (brokers.length && (await db.broker.count({ where: { id: { in: brokers }, empresaId } })) !== brokers.length) throw invalid('brokerId')

  const tramos = unique(tramoIds)
  if (tramos.length) {
    const where = { id: { in: tramos }, vuelta: { empresaId, ...(vueltaId ? { id: vueltaId } : {}) } }
    if ((await db.tramo.count({ where })) !== tramos.length) throw invalid('tramoId')
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run (in `backend/`): `node --test src/lib/tenancy.test.js`
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/lib/tenancy.js backend/src/lib/tenancy.test.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Add guard that checks referenced ids belong to the caller's company

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Trip code generation

**Files:**
- Create: `backend/src/lib/tripCode.js`
- Test: `backend/src/lib/tripCode.test.js`

**Interfaces:**
- Produces:
  - `formatCodigo(anio: number, n: number): string`
  - `nextCodigo(tx, empresaId, anio): Promise<string>` (`tx` has `$queryRaw`; one atomic upsert-increment)
  - `withTripCode(prisma, empresaId, buildAndCreate, { maxAttempts = 5, anio = current year } = {}): Promise<T>` where `buildAndCreate(tx, codigo)` creates the trip inside the transaction.

- [ ] **Step 1: Write the failing test**

Create `backend/src/lib/tripCode.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCodigo, nextCodigo, withTripCode } from './tripCode.js'

test('formatCodigo pads to three digits and grows past 999', () => {
  assert.equal(formatCodigo(2026, 1), 'VLT-2026-001')
  assert.equal(formatCodigo(2026, 42), 'VLT-2026-042')
  assert.equal(formatCodigo(2026, 999), 'VLT-2026-999')
  assert.equal(formatCodigo(2026, 1000), 'VLT-2026-1000')
})

// Fake database: the counter lives in memory and $transaction runs the callback with a fake transaction.
function fakePrisma() {
  const counters = new Map()
  const tx = {
    $queryRaw: async (_strings, empresaId, anio) => {
      const key = `${empresaId}/${anio}`
      counters.set(key, (counters.get(key) ?? 0) + 1)
      return [{ ultimo: counters.get(key) }]
    },
  }
  return { counters, $transaction: async fn => fn(tx) }
}

test('nextCodigo counts per company and per year', async () => {
  const p = fakePrisma()
  await p.$transaction(async tx => {
    assert.equal(await nextCodigo(tx, 'A', 2026), 'VLT-2026-001')
    assert.equal(await nextCodigo(tx, 'A', 2026), 'VLT-2026-002')
    assert.equal(await nextCodigo(tx, 'B', 2026), 'VLT-2026-001')
    assert.equal(await nextCodigo(tx, 'A', 2027), 'VLT-2027-001')
  })
})

test('withTripCode passes the code to the creator and returns its result', async () => {
  const p = fakePrisma()
  const out = await withTripCode(p, 'A', async (_tx, codigo) => ({ codigo }), { anio: 2026 })
  assert.deepEqual(out, { codigo: 'VLT-2026-001' })
})

test('withTripCode retries on a unique violation and moves to the next number', async () => {
  const p = fakePrisma()
  let calls = 0
  const out = await withTripCode(p, 'A', async (_tx, codigo) => {
    calls++
    if (calls === 1) throw Object.assign(new Error('unique'), { code: 'P2002' })
    return { codigo }
  }, { anio: 2026 })
  assert.equal(calls, 2)
  assert.equal(out.codigo, 'VLT-2026-002')
})

test('withTripCode gives up after five attempts', async () => {
  const p = fakePrisma()
  let calls = 0
  await assert.rejects(
    withTripCode(p, 'A', async () => { calls++; throw Object.assign(new Error('unique'), { code: 'P2002' }) }, { anio: 2026 }),
    err => err.code === 'P2002',
  )
  assert.equal(calls, 5)
})

test('withTripCode does not retry other errors', async () => {
  const p = fakePrisma()
  let calls = 0
  await assert.rejects(
    withTripCode(p, 'A', async () => { calls++; throw new Error('boom') }, { anio: 2026 }),
    /boom/,
  )
  assert.equal(calls, 1)
})
```

- [ ] **Step 2: Run to verify it fails**

Run (in `backend/`): `node --test src/lib/tripCode.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement**

Create `backend/src/lib/tripCode.js`:

```js
export const formatCodigo = (anio, n) => `VLT-${anio}-${String(n).padStart(3, '0')}`

// One atomic statement: it creates the counter row or increments it and returns the new value.
// Inside the caller's transaction, so a failed trip creation gives the number back.
export async function nextCodigo(tx, empresaId, anio) {
  const rows = await tx.$queryRaw`
    INSERT INTO "ContadorVuelta" ("empresaId", "anio", "ultimo") VALUES (${empresaId}, ${anio}, 1)
    ON CONFLICT ("empresaId", "anio") DO UPDATE SET "ultimo" = "ContadorVuelta"."ultimo" + 1
    RETURNING "ultimo"`
  return formatCodigo(anio, Number(rows[0].ultimo))
}

// Runs buildAndCreate(tx, codigo) in a transaction. A unique violation (a code created by an older backend
// between the migration and the deploy) retries with the next number, which also realigns the counter.
export async function withTripCode(prisma, empresaId, buildAndCreate, { maxAttempts = 5, anio = new Date().getFullYear() } = {}) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(async tx => buildAndCreate(tx, await nextCodigo(tx, empresaId, anio)))
    } catch (err) {
      if (err?.code !== 'P2002') throw err
      lastError = err
    }
  }
  throw lastError
}
```

- [ ] **Step 4: Run to verify it passes**

Run (in `backend/`): `node --test src/lib/tripCode.test.js`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/lib/tripCode.js backend/src/lib/tripCode.test.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Add per-company trip code generation with an atomic counter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Migration, schema and the tools that apply it

**Files:**
- Create: `backend/migrations/manual/007_tenant_trip_codes.sql`, `backend/scripts/remote-db.mjs`, `backend/scripts/apply-sql.mjs`
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: table `ContadorVuelta`; Prisma model `ContadorVuelta`; `Vuelta` unique `(empresaId, codigo)`.
- `scripts/remote-db.mjs` exports `connectToEnvironment(): Promise<{ client, envName }>`: reads `--env <name>` from `process.argv`, connects with `DATABASE_URL` (the shell value wins over `.env`), reads the `AppEnvironment` marker and exits with code 1 unless it equals `<name>`.
- `node scripts/apply-sql.mjs migrations/manual/<file>.sql --env <name>`.

- [ ] **Step 1: Migration file**

Create `backend/migrations/manual/007_tenant_trip_codes.sql`:

```sql
-- Migration: 007_tenant_trip_codes
-- Feature: trip codes are per company (atomic yearly counter) and unique per company, not globally.
-- Additive and idempotent: safe to run more than once, rewrites no code.
-- Apply to EVERY environment BEFORE deploying the backend that uses "ContadorVuelta".
-- Re-running it after the deploy realigns the counters (GREATEST) with any code created in between.

CREATE TABLE IF NOT EXISTS "ContadorVuelta" (
  "empresaId" TEXT NOT NULL,
  "anio"      INTEGER NOT NULL,
  "ultimo"    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("empresaId", "anio")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContadorVuelta_empresaId_fkey') THEN
    ALTER TABLE "ContadorVuelta" ADD CONSTRAINT "ContadorVuelta_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Start every counter at the current maximum so an old code is never issued again.
INSERT INTO "ContadorVuelta" ("empresaId", "anio", "ultimo")
SELECT "empresaId",
       CAST(substring("codigo" from 5 for 4) AS INTEGER),
       MAX(CAST(substring("codigo" from 10) AS INTEGER))
FROM "Vuelta"
WHERE "codigo" ~ '^VLT-[0-9]{4}-[0-9]+$'
GROUP BY 1, 2
ON CONFLICT ("empresaId", "anio") DO UPDATE
  SET "ultimo" = GREATEST("ContadorVuelta"."ultimo", EXCLUDED."ultimo");

CREATE UNIQUE INDEX IF NOT EXISTS "Vuelta_empresaId_codigo_key" ON "Vuelta"("empresaId", "codigo");
DROP INDEX IF EXISTS "Vuelta_codigo_key";
```

- [ ] **Step 2: Schema**

In `backend/prisma/schema.prisma`, in `model Vuelta` replace `codigo                String      @unique` with `codigo                String` and add, next to the existing `@@index([empresaId])` of that model:

```prisma
  @@unique([empresaId, codigo])
```

Add to `model Empresa` (with the other relation lists) the line `contadoresVuelta ContadorVuelta[]`, and append the model:

```prisma
// Atomic yearly counter behind the VLT-AAAA-NNN trip codes. Created by migration 007.
model ContadorVuelta {
  empresaId String
  empresa   Empresa @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  anio      Int
  ultimo    Int     @default(0)

  @@id([empresaId, anio])
}
```

Run (in `backend/`): `npx prisma generate && npx prisma validate`
Expected: "Generated Prisma Client" and "is valid".

- [ ] **Step 3: The shared connector**

Create `backend/scripts/remote-db.mjs`:

```js
import 'dotenv/config'
import pg from 'pg'
import { APP_ENVS } from '../src/lib/env.js'

// Connects with DATABASE_URL (a value set in the terminal session wins over .env) and only continues if the
// database marker equals the --env given on the command line. Never prints the connection string.
export async function connectToEnvironment() {
  const i = process.argv.indexOf('--env')
  const envName = i >= 0 ? process.argv[i + 1] : undefined
  if (!APP_ENVS.includes(envName)) {
    console.error(`Usage: node <script> ... --env <${APP_ENVS.join('|')}>`)
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const hasMarker = (await client.query(`SELECT to_regclass('"AppEnvironment"') AS t`)).rows[0].t !== null
  const marker = hasMarker ? ((await client.query('SELECT "name" FROM "AppEnvironment" WHERE "id" = 1')).rows[0]?.name ?? null) : null
  if (marker !== envName) {
    console.error(`Refusing: this database is marked "${marker ?? 'none'}" but you asked for "${envName}".`)
    await client.end()
    process.exit(1)
  }
  return { client, envName }
}
```

- [ ] **Step 4: The apply script**

Create `backend/scripts/apply-sql.mjs`:

```js
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { connectToEnvironment } from './remote-db.mjs'

const file = process.argv[2]
const dir = path.resolve('migrations/manual')
const full = file ? path.resolve(file) : ''
if (!file || file.startsWith('--') || path.dirname(full) !== dir || !full.endsWith('.sql')) {
  console.error('Usage: node scripts/apply-sql.mjs migrations/manual/<file>.sql --env <production|development|staging>')
  process.exit(1)
}

const { client, envName } = await connectToEnvironment()
try {
  await client.query(readFileSync(full, 'utf8'))
  console.log(`Applied ${path.basename(full)} to the ${envName} database.`)
} finally {
  await client.end()
}
```

- [ ] **Step 5: Syntax, tests, apply to the development database**

Run (in `backend/`): `node --check scripts/remote-db.mjs && node --check scripts/apply-sql.mjs && npm test`
Expected: no errors, whole suite passes.

Run (in `backend/`, `.env` is development): `node scripts/apply-sql.mjs migrations/manual/007_tenant_trip_codes.sql --env development` twice.
Expected both times: `Applied 007_tenant_trip_codes.sql to the development database.`

Run (in `backend/`): `node scripts/apply-sql.mjs migrations/manual/007_tenant_trip_codes.sql --env production`
Expected: `Refusing: this database is marked "development" but you asked for "production".` and exit code 1. (This proves the safety check; nothing is applied.)

- [ ] **Step 6: Commit**

```bash
git -c safe.directory='*' add backend/migrations/manual/007_tenant_trip_codes.sql backend/prisma/schema.prisma backend/scripts/remote-db.mjs backend/scripts/apply-sql.mjs
git -c safe.directory='*' commit -q -F - <<'EOF'
Add per-company trip code counter migration and a safe SQL apply script

Migration 007 must be applied to production before deploying the code that uses it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Split the app from the boot sequence

**Files:**
- Create: `backend/src/app.js`
- Modify: `backend/src/index.js`

**Interfaces:**
- Produces: `backend/src/app.js` exports `app` (the Express app with middleware, routes and the error handler, not listening). `index.js` keeps `dotenv`, `validateEnv`, the marker guard, the city seed, the cron and `listen`.

- [ ] **Step 1: Read `backend/src/index.js` completely.**

- [ ] **Step 2: Create `backend/src/app.js`**

Move into it, unchanged and in the same order: every `import` of `express`, `cors`, `cookie-parser`, `helmet`, `errorHandler`, all routers, `jwtAuth`, and `getAllowedOrigins`/`isOriginAllowed`; then the block from `const app = express()` through `app.use(errorHandler)` (trust proxy, helmet, the `[cors]` log and warning, cors, `express.json`, cookie parser, health route, routers, viewer guard, error handler). End the file with `export { app }`. Do not import `dotenv/config`, `validateEnv`, `prisma`, `runSeed`, `startNotificacionesCron` or `assertDatabaseEnvironment` there.

- [ ] **Step 3: Rewrite `backend/src/index.js`**

Keep only:

```js
import 'dotenv/config'
import { app } from './app.js'
import { startNotificacionesCron } from './jobs/notificaciones.job.js'
import { runSeed } from './seeds/runSeed.js'
import { validateEnv } from './lib/env.js'
import prisma from './lib/prisma.js'
import { assertDatabaseEnvironment } from './lib/environment.js'

validateEnv()

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
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  startNotificacionesCron()
})
```

(`import 'dotenv/config'` stays first so the environment is loaded before `app.js` reads `ALLOWED_ORIGINS`.)

- [ ] **Step 4: Verify nothing changed in behavior**

Run (in `backend/`): `node --check src/app.js && node --check src/index.js && npm test`
Expected: no errors, whole suite passes.

Run (in `backend/`, development `.env`): start `node src/index.js` in the background, `curl -s http://localhost:3000/api/health`, then stop it.
Expected: `{"status":"ok"}` and the log lines `[env] APP_ENV=development, the database marker matches` and `Backend running on port 3000`. Confirm nothing is left listening on port 3000.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/app.js backend/src/index.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Split the Express app from the boot sequence

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Wire the guard, the codes and the smaller fixes into the controllers

**Files:**
- Modify: `backend/src/controllers/vueltas.controller.js`, `tramos.controller.js`, `gastos.controller.js`, `sugerencias.controller.js`, `admin.controller.js`, `vueltas.controller.test.js`
- Check: `frontend/src` for `topRoutes`

**Interfaces:**
- Consumes: `assertOwnedReferences` (Task 1), `withTripCode` (Task 2), the `ContadorVuelta` table (Task 3).

The behavior is covered by the unit tests of Tasks 1 and 2 and by the integration suite of Task 6. This task is wiring.

- [ ] **Step 1: `vueltas.controller.js`**

Add imports:

```js
import { assertOwnedReferences } from '../lib/tenancy.js'
import { withTripCode } from '../lib/tripCode.js'
```

Delete `buildNextCodigo` and `generarCodigo` (lines 5 to 18). Replace `createVuelta` with:

```js
export const createVuelta = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const { camionId, conductorPrincipalId, conductorSecundarioId, tramos = [], gastos = [] } = req.body
  await assertOwnedReferences(prisma, empresaId, {
    camionId, conductorPrincipalId, conductorSecundarioId,
    brokerIds: tramos.map(t => t.brokerId),
    tramoIds: gastos.map(g => g.tramoId),
  })
  const vuelta = await withTripCode(prisma, empresaId, (tx, codigo) => tx.vuelta.create({
    data: prepareCreateVueltaData({ body: req.body, empresaId, codigo }),
    include: {
      camion: true,
      conductorPrincipal: true,
      conductorSecundario: true,
      tramos: { orderBy: { orden: 'asc' }, select: { destino: true, numeroCarga: true } },
    },
  }))
  res.status(201).json(vuelta)
})
```

In `updateVuelta`, right after the "Vuelta not found" check add:

```js
  await assertOwnedReferences(prisma, empresaId, {
    camionId: req.body.camionId,
    conductorPrincipalId: req.body.conductorPrincipalId,
    conductorSecundarioId: req.body.conductorSecundarioId,
  })
```

In `mergeVueltas`, after the "vueltas no encontradas" check and replacing `const codigo = await generarCodigo(empresaId)` add:

```js
  await assertOwnedReferences(prisma, empresaId, { camionId, conductorPrincipalId, conductorSecundarioId })
```

and change the transaction to use `withTripCode`:

```js
  const newVuelta = await withTripCode(prisma, empresaId, async (tx, codigo) => {
    const vuelta = await tx.vuelta.create({
      data: {
        empresaId, camionId, conductorPrincipalId, baseSalida, fechaSalida: new Date(fechaSalida), codigo,
        ...(conductorSecundarioId ? { conductorSecundarioId } : {}),
      },
    })
    // ... the rest of the existing transaction body (moving legs and expenses, deleting the sources) unchanged ...
    return vuelta
  })
```

(Keep the body between `const vuelta = ...` and `return vuelta` exactly as it is today.)

- [ ] **Step 2: `tramos.controller.js`**

Add `import { assertOwnedReferences } from '../lib/tenancy.js'`. In `createTramo` after the "Vuelta not found" check add `await assertOwnedReferences(prisma, empresaId, { brokerIds: [req.body.brokerId] })`. In `updateTramo` after the "Tramo not found" check add the same line.

- [ ] **Step 3: `gastos.controller.js`**

Add the same import. In `createGasto` after the "Vuelta not found" check add:

```js
  await assertOwnedReferences(prisma, empresaId, { tramoIds: [req.body.tramoId], vueltaId: req.params.id })
```

In `updateGasto` after the "Gasto not found" check add:

```js
  await assertOwnedReferences(prisma, empresaId, { tramoIds: [req.body.tramoId], vueltaId: gasto.vueltaId })
```

- [ ] **Step 4: `sugerencias.controller.js`**

Replace both `prisma.camion.findUnique({ where: { id } })` with `prisma.camion.findFirst({ where: { id, empresaId } })` and both `prisma.conductor.findUnique({ where: { id } })` with `prisma.conductor.findFirst({ where: { id, empresaId } })`.

- [ ] **Step 5: `admin.controller.js`**

Remove the `topRoutes` query from the `Promise.all` and the `topRoutes` field from the response, so it returns `{ totalRoutesCache, totalGeocodeCache, totalCacheHits }`.

Run: `grep -rn "topRoutes" frontend/src backend/src`
If the frontend renders it, remove that part of the page and keep the counters.

- [ ] **Step 6: Update the old unit test**

In `backend/src/controllers/vueltas.controller.test.js` remove the `buildNextCodigo` import and its test (the code generation now lives in `tripCode.test.js`). Keep the `prepareCreateVueltaData` test.

- [ ] **Step 7: Verify**

Run (in `backend/`): `for f in src/controllers/vueltas.controller.js src/controllers/tramos.controller.js src/controllers/gastos.controller.js src/controllers/sugerencias.controller.js src/controllers/admin.controller.js; do node --check $f || echo "FAILED $f"; done && npm test`
Expected: no `FAILED`, whole suite passes. In `frontend/`: `npx eslint src && npx vite build` if the frontend was touched (no new lint errors in touched files).

- [ ] **Step 8: Commit**

```bash
git -c safe.directory='*' add backend/src frontend/src
git -c safe.directory='*' commit -q -F - <<'EOF'
Check company ownership of referenced ids and use per-company trip codes

- trips, legs and expenses reject ids of other companies with Invalid <field>
- create and merge trips take their code from the atomic per-company counter
- sugerencias loads trucks and drivers scoped to the company
- cache-stats no longer exposes the most requested routes of all companies

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Integration suite against the development database

**Files:**
- Create: `backend/test/integration/tenancy.test.js`
- Modify: `backend/package.json` (script `test:integration`)

**Interfaces:**
- Consumes: `app` (Task 4), all controllers (Task 5), the development database with migration 007 applied (Task 3).

- [ ] **Step 1: Add the script**

In `backend/package.json` `scripts` add `"test:integration": "node --test \"test/integration/**/*.test.js\""`.

- [ ] **Step 2: Write the suite**

Create `backend/test/integration/tenancy.test.js`:

```js
import 'dotenv/config'
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import prisma from '../../src/lib/prisma.js'
import { readMarker, checkDestructiveAllowed } from '../../src/lib/environment.js'
import { signAccess } from '../../src/lib/jwt.js'
import { app } from '../../src/app.js'

const stamp = Date.now()
const year = new Date().getFullYear()
const companies = {}
let server
let base

async function makeCompany(tag) {
  const empresa = await prisma.empresa.create({ data: { nombre: `Prueba integración ${tag} ${stamp}` } })
  const usuario = await prisma.usuario.create({
    data: { empresaId: empresa.id, nombre: `Admin ${tag}`, email: `int.${tag}.${stamp}@example.com`, password: 'x', rol: 'admin' },
  })
  const camion = await prisma.camion.create({ data: { empresaId: empresa.id, placa: `P-${tag}-${stamp}`, modelo: 'Test', tipo: 'dry_van' } })
  const conductor1 = await prisma.conductor.create({ data: { empresaId: empresa.id, nombre: `Conductor 1 ${tag}` } })
  const conductor2 = await prisma.conductor.create({ data: { empresaId: empresa.id, nombre: `Conductor 2 ${tag}` } })
  const broker = await prisma.broker.create({ data: { empresaId: empresa.id, nombre: `Broker ${tag} ${stamp}` } })
  // Seed trips use fixed codes so the per-company counter still starts at 001 for the first trip created through the API.
  const vuelta = await prisma.vuelta.create({
    data: {
      empresaId: empresa.id, camionId: camion.id, conductorPrincipalId: conductor1.id, codigo: `SEED-${tag}-1`,
      baseSalida: 'Miami, FL', fechaSalida: new Date(),
      tramos: { create: [{ orden: 1, origen: 'Miami, FL', destino: 'Atlanta, GA', fleteCobrado: 100, brokerId: broker.id }] },
    },
    include: { tramos: true },
  })
  const vuelta2 = await prisma.vuelta.create({
    data: { empresaId: empresa.id, camionId: camion.id, conductorPrincipalId: conductor1.id, codigo: `SEED-${tag}-2`, baseSalida: 'Miami, FL', fechaSalida: new Date() },
  })
  const gasto = await prisma.gasto.create({ data: { vueltaId: vuelta.id, categoria: 'combustible', monto: 10 } })
  const token = signAccess({ userId: usuario.id, empresaId: empresa.id, rol: 'admin' })
  return { empresa, usuario, camion, conductor1, conductor2, broker, vuelta, vuelta2, tramo: vuelta.tramos[0], gasto, token }
}

async function destroyCompany(c) {
  const where = { empresaId: c.empresa.id }
  await prisma.vuelta.deleteMany({ where })
  await prisma.camion.deleteMany({ where })
  await prisma.conductor.deleteMany({ where })
  await prisma.broker.deleteMany({ where })
  await prisma.contadorVuelta.deleteMany({ where })
  await prisma.empresa.delete({ where: { id: c.empresa.id } })
}

const call = (token, method, path, body) => fetch(base + path, {
  method,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
})

const tripBody = (c, extra = {}) => ({
  camionId: c.camion.id, conductorPrincipalId: c.conductor1.id, baseSalida: 'Tampa, FL', fechaSalida: new Date().toISOString(), ...extra,
})

before(async () => {
  const verdict = checkDestructiveAllowed({ appEnv: process.env.APP_ENV, marker: await readMarker(prisma) })
  if (!verdict.ok) throw new Error(`Integration tests refuse to run: ${verdict.message}`)
  companies.A = await makeCompany('A')
  companies.B = await makeCompany('B')
  server = app.listen(0)
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server?.close()
  for (const c of Object.values(companies)) await destroyCompany(c)
  await prisma.$disconnect()
})

test('creating a trip with a foreign truck, driver or broker is rejected', async () => {
  const { A, B } = companies
  const cases = [
    [tripBody(A, { camionId: B.camion.id }), 'Invalid camionId'],
    [tripBody(A, { conductorPrincipalId: B.conductor1.id }), 'Invalid conductorPrincipalId'],
    [tripBody(A, { conductorSecundarioId: B.conductor2.id }), 'Invalid conductorSecundarioId'],
    [tripBody(A, { tramos: [{ orden: 1, origen: 'a', destino: 'b', brokerId: B.broker.id }] }), 'Invalid brokerId'],
    [tripBody(A, { gastos: [{ categoria: 'x', monto: 1, tramoId: B.tramo.id }] }), 'Invalid tramoId'],
  ]
  for (const [body, message] of cases) {
    const res = await call(A.token, 'POST', '/api/vueltas', body)
    assert.equal(res.status, 400, message)
    assert.equal((await res.json()).error, message)
  }
})

test('updating a trip with a foreign truck or driver is rejected, and its own ids still work', async () => {
  const { A, B } = companies
  const bad = await call(A.token, 'PUT', `/api/vueltas/${A.vuelta.id}`, { camionId: B.camion.id })
  assert.equal(bad.status, 400)
  const bad2 = await call(A.token, 'PUT', `/api/vueltas/${A.vuelta.id}`, { conductorSecundarioId: B.conductor2.id })
  assert.equal(bad2.status, 400)
  const ok = await call(A.token, 'PUT', `/api/vueltas/${A.vuelta.id}`, { conductorSecundarioId: A.conductor2.id })
  assert.equal(ok.status, 200)
})

test('merging trips with a foreign truck is rejected', async () => {
  const { A, B } = companies
  const res = await call(A.token, 'POST', '/api/vueltas/merge', {
    vueltaIds: [A.vuelta.id, A.vuelta2.id], camionId: B.camion.id, conductorPrincipalId: A.conductor1.id,
    baseSalida: 'Miami, FL', fechaSalida: new Date().toISOString(),
  })
  assert.equal(res.status, 400)
  assert.equal((await res.json()).error, 'Invalid camionId')
})

test('legs: a foreign broker is rejected on create and update', async () => {
  const { A, B } = companies
  const create = await call(A.token, 'POST', `/api/vueltas/${A.vuelta.id}/tramos`, { orden: 2, origen: 'a', destino: 'b', brokerId: B.broker.id })
  assert.equal(create.status, 400)
  const update = await call(A.token, 'PUT', `/api/tramos/${A.tramo.id}`, { brokerId: B.broker.id })
  assert.equal(update.status, 400)
  const ok = await call(A.token, 'PUT', `/api/tramos/${A.tramo.id}`, { brokerId: A.broker.id })
  assert.equal(ok.status, 200)
})

test('expenses: the leg must belong to the same trip', async () => {
  const { A, B } = companies
  const foreign = await call(A.token, 'POST', `/api/vueltas/${A.vuelta.id}/gastos`, { categoria: 'x', monto: 1, tramoId: B.tramo.id })
  assert.equal(foreign.status, 400)
  const otherTrip = await call(A.token, 'POST', `/api/vueltas/${A.vuelta2.id}/gastos`, { categoria: 'x', monto: 1, tramoId: A.tramo.id })
  assert.equal(otherTrip.status, 400)
  const ok = await call(A.token, 'POST', `/api/vueltas/${A.vuelta.id}/gastos`, { categoria: 'x', monto: 1, tramoId: A.tramo.id })
  assert.equal(ok.status, 201)
  const update = await call(A.token, 'PUT', `/api/gastos/${A.gasto.id}`, { tramoId: B.tramo.id })
  assert.equal(update.status, 400)
})

test('company A cannot read, change or delete records of company B', async () => {
  const { A, B } = companies
  for (const [method, path, body] of [
    ['GET', `/api/vueltas/${B.vuelta.id}`], ['PUT', `/api/vueltas/${B.vuelta.id}`, { notas: 'x' }], ['DELETE', `/api/vueltas/${B.vuelta.id}`],
    ['PATCH', `/api/vueltas/${B.vuelta.id}/estado`, { estado: 'en_curso' }],
    ['POST', `/api/vueltas/${B.vuelta.id}/tramos`, { orden: 5, origen: 'a', destino: 'b' }],
    ['POST', `/api/vueltas/${B.vuelta.id}/gastos`, { categoria: 'x', monto: 1 }],
    ['PUT', `/api/tramos/${B.tramo.id}`, { notas: 'x' }], ['DELETE', `/api/tramos/${B.tramo.id}`],
    ['PUT', `/api/gastos/${B.gasto.id}`, { monto: 2 }], ['DELETE', `/api/gastos/${B.gasto.id}`],
  ]) {
    const res = await call(A.token, method, path, body)
    assert.equal(res.status, 404, `${method} ${path}`)
  }
  const stillThere = await prisma.vuelta.count({ where: { id: B.vuelta.id } })
  assert.equal(stillThere, 1)
})

test('lists never include another company\'s data', async () => {
  const { A, B } = companies
  const trips = await (await call(A.token, 'GET', '/api/vueltas')).json()
  assert.ok(trips.length >= 2)
  assert.equal(trips.some(t => t.empresaId === B.empresa.id || t.id === B.vuelta.id), false)
  const trucks = await (await call(A.token, 'GET', '/api/camiones')).json()
  assert.equal(trucks.some(t => t.id === B.camion.id), false)
})

test('two companies both start their codes at 001', async () => {
  const { A, B } = companies
  const a = await (await call(A.token, 'POST', '/api/vueltas', tripBody(A))).json()
  const b = await (await call(B.token, 'POST', '/api/vueltas', tripBody(B))).json()
  assert.equal(a.codigo, `VLT-${year}-001`)
  assert.equal(b.codigo, `VLT-${year}-001`)
})

test('20 simultaneous creations give 20 distinct consecutive codes and a deleted code is not reused', async () => {
  const C = await makeCompany('C')
  companies.C = C
  const results = await Promise.all(Array.from({ length: 20 }, () => call(C.token, 'POST', '/api/vueltas', tripBody(C))))
  assert.ok(results.every(r => r.status === 201), 'every creation succeeded')
  const codes = (await Promise.all(results.map(r => r.json()))).map(t => t.codigo)
  assert.equal(new Set(codes).size, 20)
  const numbers = codes.map(c => Number(c.split('-')[2])).sort((x, y) => x - y)
  assert.deepEqual(numbers, Array.from({ length: 20 }, (_, i) => i + 1))

  const last = await prisma.vuelta.findFirst({ where: { empresaId: C.empresa.id, codigo: `VLT-${year}-020` } })
  const del = await call(C.token, 'DELETE', `/api/vueltas/${last.id}`)
  assert.equal(del.status, 200)
  const next = await (await call(C.token, 'POST', '/api/vueltas', tripBody(C))).json()
  assert.equal(next.codigo, `VLT-${year}-021`)
})

test('a code created behind the counter is skipped by the retry', async () => {
  const C = companies.C
  // Simulates the old backend creating VLT-<year>-022 after the counter stood at 021.
  await prisma.vuelta.create({
    data: { empresaId: C.empresa.id, camionId: C.camion.id, conductorPrincipalId: C.conductor1.id, codigo: `VLT-${year}-022`, baseSalida: 'x', fechaSalida: new Date() },
  })
  const res = await call(C.token, 'POST', '/api/vueltas', tripBody(C))
  assert.equal(res.status, 201)
  assert.equal((await res.json()).codigo, `VLT-${year}-023`)
})

test('cache-stats no longer lists the most requested routes', async () => {
  const res = await call(companies.A.token, 'GET', '/api/admin/cache-stats')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal('topRoutes' in body, false)
  assert.equal(typeof body.totalRoutesCache, 'number')
})
```

- [ ] **Step 3: Run it against the development database**

Run (in `backend/`, `.env` is development): `npm run test:integration`
Expected: every test passes. If one fails, stop and debug (superpowers:systematic-debugging): the failing assertion shows which endpoint still lacks a check.

- [ ] **Step 4: Prove the suite refuses anything but development**

Run (in `backend/`): `APP_ENV=production npm run test:integration`
Expected: it fails at once with `Integration tests refuse to run: Refusing to run: this script deletes data and never runs with APP_ENV=production.` and creates nothing.

- [ ] **Step 5: Check the test data was cleaned**

Run (in `backend/`): `node -e "import('dotenv/config').then(async()=>{const {default:p}=await import('./src/lib/prisma.js');console.log('left over test companies:',await p.empresa.count({where:{nombre:{startsWith:'Prueba integración'}}}));await p.\$disconnect()})"`
Expected: `left over test companies: 0`.

- [ ] **Step 6: Run the unit suite and commit**

Run (in `backend/`): `npm test`
Expected: whole suite passes and does NOT include the integration file.

```bash
git -c safe.directory='*' add backend/test/integration/tenancy.test.js backend/package.json
git -c safe.directory='*' commit -q -F - <<'EOF'
Add tenant isolation integration tests against the development database

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Production tools for the owner

**Files:**
- Create: `backend/scripts/audit-tenancy.mjs`, `backend/scripts/cleanup-test-data.mjs`

**Interfaces:**
- Consumes: `connectToEnvironment` (Task 3).

- [ ] **Step 1: The audit (read-only)**

Create `backend/scripts/audit-tenancy.mjs`:

```js
import { connectToEnvironment } from './remote-db.mjs'

const { client, envName } = await connectToEnvironment()

const checks = [
  ['trips whose truck belongs to another company',
    `SELECT count(*)::int AS n FROM "Vuelta" v JOIN "Camion" c ON c."id" = v."camionId" WHERE c."empresaId" <> v."empresaId"`],
  ['trips whose main driver belongs to another company',
    `SELECT count(*)::int AS n FROM "Vuelta" v JOIN "Conductor" c ON c."id" = v."conductorPrincipalId" WHERE c."empresaId" <> v."empresaId"`],
  ['trips whose second driver belongs to another company',
    `SELECT count(*)::int AS n FROM "Vuelta" v JOIN "Conductor" c ON c."id" = v."conductorSecundarioId" WHERE c."empresaId" <> v."empresaId"`],
  ['legs whose broker belongs to another company',
    `SELECT count(*)::int AS n FROM "Tramo" t JOIN "Vuelta" v ON v."id" = t."vueltaId" JOIN "Broker" b ON b."id" = t."brokerId" WHERE b."empresaId" <> v."empresaId"`],
  ['expenses linked to a leg of another trip',
    `SELECT count(*)::int AS n FROM "Gasto" g JOIN "Tramo" t ON t."id" = g."tramoId" WHERE t."vueltaId" <> g."vueltaId"`],
  ['trip codes repeated inside one company (would block the new unique index)',
    `SELECT count(*)::int AS n FROM (SELECT 1 FROM "Vuelta" GROUP BY "empresaId", "codigo" HAVING count(*) > 1) x`],
  ['trip codes that do not match VLT-YYYY-N (kept as they are, not counted by the counter)',
    `SELECT count(*)::int AS n FROM "Vuelta" WHERE "codigo" !~ '^VLT-[0-9]{4}-[0-9]+$'`],
]

try {
  console.log(`Tenancy audit of the ${envName} database (counts only)`)
  let problems = 0
  for (const [label, sql] of checks) {
    const n = (await client.query(sql)).rows[0].n
    console.log(`${String(n).padStart(5)}  ${label}`)
    if (n > 0 && !label.startsWith('trip codes that do not match')) problems += n
  }
  console.log(problems === 0 ? '\nRESULT: clean, safe to apply migration 007.' : '\nRESULT: found data to review before continuing.')
} finally {
  await client.end()
}
```

- [ ] **Step 2: The test-data cleanup**

Create `backend/scripts/cleanup-test-data.mjs`:

```js
import { connectToEnvironment } from './remote-db.mjs'

const { client, envName } = await connectToEnvironment()
const TEST_COMPANY = 'Prueba Dia4 (borrar)'

try {
  const found = await client.query(
    `SELECT e."id" FROM "Empresa" e
     WHERE e."nombre" = $1
       AND NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u."empresaId" = e."id" AND u."email" NOT LIKE 'prueba.dia4.%@example.com')`,
    [TEST_COMPANY],
  )
  const ids = found.rows.map(r => r.id)
  console.log(`Test companies found in the ${envName} database: ${ids.length}`)
  if (ids.length) {
    await client.query('BEGIN')
    for (const table of ['Vuelta', 'Camion', 'Conductor', 'Trailer', 'Broker', 'Notificacion', 'ContadorVuelta']) {
      const r = await client.query(`DELETE FROM "${table}" WHERE "empresaId" = ANY($1)`, [ids])
      console.log(`  deleted ${r.rowCount} from ${table}`)
    }
    const r = await client.query('DELETE FROM "Empresa" WHERE "id" = ANY($1)', [ids])
    console.log(`  deleted ${r.rowCount} companies (their users and sessions go with them)`)
    await client.query('COMMIT')
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {})
  throw err
} finally {
  await client.end()
}
```

- [ ] **Step 3: Check them against the development database**

Run (in `backend/`): `node --check scripts/audit-tenancy.mjs && node --check scripts/cleanup-test-data.mjs && node scripts/audit-tenancy.mjs --env development`
Expected: counts printed and `RESULT: clean, safe to apply migration 007.`

Run (in `backend/`): `node scripts/cleanup-test-data.mjs --env development`
Expected: `Test companies found in the development database: 0`.

Run (in `backend/`): `node scripts/audit-tenancy.mjs --env production`
Expected: refused because the local marker is `development`, exit code 1.

- [ ] **Step 4: Commit**

```bash
git -c safe.directory='*' add backend/scripts/audit-tenancy.mjs backend/scripts/cleanup-test-data.mjs
git -c safe.directory='*' commit -q -F - <<'EOF'
Add tenancy audit and test-data cleanup scripts for any environment

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Docs, roll out and verify in production

**Files:**
- Modify: `docs/entornos.md`, `docs/plan-mejoras-tms.html` (untracked)
- Temporary: an API verification script in the scratchpad directory (never committed)

Steps 2 to 4 change production: get the owner's explicit OK first.

- [ ] **Step 1: Document the scripts**

In `docs/entornos.md` replace section 9 (migration map) adding `007_tenant_trip_codes.sql` (counter table and per-company unique) and change "La siguiente libre es la `007`" to "La siguiente libre es la `008`, reservada para 'olvidé mi contraseña'". Also update the forgot-password revision notes (`007_password_reset.sql` becomes `008_password_reset.sql`) in both forgot-password docs. Add a new section "Scripts para cualquier entorno" that explains, in Spanish, `apply-sql`, `audit-tenancy` and `cleanup-test-data`, and the exact way to run them on production from PowerShell without leaving the connection anywhere:

```powershell
cd backend
$env:DATABASE_URL = Read-Host "Cadena de conexión de producción"
node scripts/audit-tenancy.mjs --env production
Remove-Item Env:DATABASE_URL
```

(Explain that `Read-Host` keeps the string out of the command history and that the variable disappears when the terminal closes or with the last line.)

- [ ] **Step 2: OWNER runs the audit on production**

The owner runs the block above. They paste only the printed counts. If every count is 0, continue. Any non-zero count: stop and decide together (nulling the reference, moving the record, or leaving it) before applying anything.

- [ ] **Step 3: OWNER applies migration 007 on production**

Same block with `node scripts/apply-sql.mjs migrations/manual/007_tenant_trip_codes.sql --env production` (run it twice, it is idempotent), then the audit again. Expected: `Applied 007_tenant_trip_codes.sql to the production database.`

- [ ] **Step 4: Push and verify the deploy (with the owner's OK)**

Run: `git -c safe.directory='*' push origin master`. Check the CI run on master through the GitHub API as before (`backend`, `frontend`, `audit` green). Wait until production serves the new code: `curl -s https://fleetguardian-tms-production.up.railway.app/api/admin/cache-stats` answers 401 without a token, so poll instead with `POST /api/vueltas` without a token (401) and rely on the API verification below; then poll `/api/health` until 200 for a few minutes and ask the owner to confirm in the Railway log the line `[env] APP_ENV=production, the database marker matches`.

- [ ] **Step 5: API verification with two throwaway companies**

Write `verify-tenancy.mjs` in the scratchpad (uses only `fetch`). It registers two companies through `POST /api/auth/register` with emails `prueba.dia4.a.<stamp>@example.com` and `prueba.dia4.b.<stamp>@example.com` and the company name `Prueba Dia4 (borrar)` (2 registrations, under the limit of 5 per hour), creates a truck and two drivers in each through `POST /api/camiones` and `POST /api/conductores` (use the fields those routes require), then checks: A gets 400 `Invalid camionId` creating a trip with B's truck; A gets 404 reading B's trip; both companies' first trips are `VLT-<year>-001`; `GET /api/admin/cache-stats` has no `topRoutes`; a normal trip creation still works. Print PASS or FAIL per line and never print tokens.

Ask the owner to run the cleanup afterwards:

```powershell
cd backend
$env:DATABASE_URL = Read-Host "Cadena de conexión de producción"
node scripts/cleanup-test-data.mjs --env production
Remove-Item Env:DATABASE_URL
```

Expected: 2 test companies found and deleted, and the audit shows the same counts as before the test.

- [ ] **Step 6: Realign the counters after the deploy**

The owner runs `apply-sql.mjs migrations/manual/007_tenant_trip_codes.sql --env production` once more (idempotent, `GREATEST` keeps every counter at or above the largest code that exists), in case the old backend created a code between the migration and the deploy.

- [ ] **Step 7: Record the outcome**

Annotate day 4 in `docs/plan-mejoras-tms.html` after Steps 4 and 5 pass (mark the four tasks "hecho el 21 sept", mention the integration suite and the production tools). Validate its inline script with `node --check` as before. Update the project memory file `tms-day1-security-progress.md`: day 4 done, migration 007 applied to production, what the owner still has to run, the unpushed commits.

---

## Self-Review

**Spec coverage:** guard with all fields, same 400, same-trip rule for expenses (Tasks 1 and 5); counter table, per-company unique, formatting past 999, retry, no reuse, backfill, existing codes untouched (Tasks 2 and 3); `sugerencias` scoping and `topRoutes` removal (Task 5); `app.js` split, integration suite with the development-only refusal, two companies at 001, 20 concurrent creations, deleted code not reused, retry over a code created behind the counter (Tasks 4 and 6); audit, apply and cleanup scripts with `--env` and marker check (Tasks 3 and 7); rollout order audit, migration, push, verification, cleanup, realignment, docs and HTML (Task 8). Out-of-scope items are not planned.

**Placeholders:** the only descriptive step is Task 8 step 5 (the production verification script), whose checks are listed one by one and whose routes `/api/camiones` and `/api/conductores` are read from the routers at that time; Task 4 step 2 moves existing code verbatim. No TBD or "similar to" steps.

**Types:** `assertOwnedReferences` fields, `formatCodigo`, `nextCodigo`, `withTripCode`, `connectToEnvironment`, `app`, and the `ContadorVuelta` model (`empresaId`, `anio`, `ultimo`, composite id) are used with the same names everywhere. The fake `$queryRaw(strings, empresaId, anio)` in the tests matches the tagged template in `nextCodigo`, and `prisma.contadorVuelta` in the integration teardown matches the model name.
