# Sessions and Login Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh tokens are backed by server-side sessions that rotate on every use, stolen tokens are detected, sessions can be revoked, and login resists guessing and user enumeration.

**Architecture:** A `Sesion` table holds one row per refresh token; the refresh JWT carries the row id as its `jti`. A small session service (database injected, unit-testable) starts, rotates (with a 10 second grace window) and ends sessions. Controllers call it on login, register, refresh, logout, change password and admin reset. `express-rate-limit` limiters add per-email login limits, a refresh limit and a per-user limit on document extraction.

**Tech Stack:** Node 25, Express 5, Prisma 7 (PrismaPg, PostgreSQL), jsonwebtoken, bcryptjs, express-rate-limit 8, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-20-sessions-and-login-limits-design.md`

## Global Constraints

- Session lifetime 7 days (same as the refresh JWT). Rotation grace window 10 000 ms.
- Reuse detection: presenting a session that was rotated more than the grace window ago deletes ALL sessions of that user and answers 401.
- A refresh token without `jti` (issued before this deploy) is rejected with 401.
- Login limits per email (normalized): 5 failed attempts per 15 minutes and 15 per 24 hours, failures only (`skipSuccessfulRequests`). Existing per-IP login limit (10 per 15 minutes) stays. Refresh: 60 per 15 minutes per IP. Extraction endpoints: 10 per hour per user.
- Unknown email must cost the same as a wrong password: always run `bcrypt.compare`, against a constant dummy hash when the user does not exist.
- The migration is additive and idempotent and must be applied to production BEFORE the backend code is pushed (every login creates a session row).
- Repo rules: run backend tests with `npm test` inside `backend/` (never `node --test src/`, it boots the real server against the shared production DB). Git needs `git -c safe.directory='*'`. Commit messages end with a blank line and `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Do not push unless the user asks. ES modules with explicit `.js` imports, no semicolons, single quotes.
- Never test session reuse or lockout against the owner's own account: it would log the owner out or lock their login. Use a throwaway invited user.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/lib/jwt.js` | `signRefresh(payload, sid)` puts the session id in `jti` |
| `backend/src/services/session.service.js` (new) | `createSessionService`, `createPrismaSessionDb` |
| `backend/src/lib/sessions.js` (new) | The app-wide `sessions` instance backed by Prisma |
| `backend/migrations/manual/005_sessions.sql` (new), `backend/prisma/schema.prisma` | Table and model |
| `backend/src/lib/rateLimits.js` | Email login limiters, refresh limiter, extract limiter |
| `backend/src/controllers/auth.controller.js`, `backend/src/routes/auth.js` | Session wiring, dummy hash, `logout-all`, limiters |
| `backend/src/controllers/usuarios.controller.js` | Admin reset ends the target's sessions |
| `backend/src/routes/ratecon.js`, `backend/src/routes/registration.js` | Extract limiter |

---

### Task 1: Session id in the refresh token

**Files:**
- Modify: `backend/src/lib/jwt.js`
- Test: `backend/src/lib/jwt.test.js` (new)

**Interfaces:**
- Produces: `signRefresh(payload, sid?)`: when `sid` is given the token's `jti` claim equals `sid`. `verifyRefresh(token)` returns the payload including `jti`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/lib/jwt.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { signRefresh, verifyRefresh, signAccess, verifyAccess } from './jwt.js'

process.env.JWT_SECRET ??= 'test-access-secret'
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret'

const payload = { userId: 'u1', empresaId: 'e1', rol: 'admin' }

test('the refresh token carries the session id as jti', () => {
  const decoded = verifyRefresh(signRefresh(payload, 'session-1'))
  assert.equal(decoded.jti, 'session-1')
  assert.equal(decoded.userId, 'u1')
})

test('without a session id there is no jti (old tokens look like this)', () => {
  assert.equal(verifyRefresh(signRefresh(payload)).jti, undefined)
})

test('access tokens are unchanged and have no jti', () => {
  const decoded = verifyAccess(signAccess(payload))
  assert.equal(decoded.rol, 'admin')
  assert.equal(decoded.jti, undefined)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `backend/`): `node --test src/lib/jwt.test.js`
Expected: the first test FAILS (`jti` is `undefined`, expected `'session-1'`).

- [ ] **Step 3: Write minimal implementation**

In `backend/src/lib/jwt.js` replace `signRefresh` with:

```js
export function signRefresh(payload, sid) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d', ...(sid ? { jwtid: sid } : {}) })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (in `backend/`): `node --test src/lib/jwt.test.js`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/lib/jwt.js backend/src/lib/jwt.test.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Put the session id in the refresh token jti

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Migration and Prisma schema

**Files:**
- Create: `backend/migrations/manual/005_sessions.sql`
- Modify: `backend/prisma/schema.prisma` (model `Usuario`)

**Interfaces:**
- Produces: table `Sesion`, Prisma client member `prisma.sesion` with fields `id`, `usuarioId`, `expiresAt`, `rotatedAt`, `creadoEn`.

This task does NOT touch production. Applying the SQL is Task 6.

- [ ] **Step 1: Write the migration**

Create `backend/migrations/manual/005_sessions.sql`:

```sql
-- Migration: 005_sessions
-- Feature: server-side refresh sessions (rotation, reuse detection, revocation)
-- Additive and idempotent: safe to run more than once, deletes no data.
-- Apply to EVERY environment BEFORE deploying the backend code that creates sessions on login.

CREATE TABLE IF NOT EXISTS "Sesion" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "usuarioId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "rotatedAt" TIMESTAMP(3),
  "creadoEn"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sesion_usuarioId_fkey') THEN
    ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
```

- [ ] **Step 2: Update the Prisma schema**

In `backend/prisma/schema.prisma`, inside `model Usuario`, replace:

```prisma
  creadoEn           DateTime @default(now())

  @@index([empresaId])
}
```

with:

```prisma
  creadoEn           DateTime @default(now())
  sesiones           Sesion[]

  @@index([empresaId])
}

model Sesion {
  id        String    @id
  usuarioId String
  usuario   Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  rotatedAt DateTime?
  creadoEn  DateTime  @default(now())

  @@index([usuarioId])
}
```

- [ ] **Step 3: Regenerate the client and check it**

Run (in `backend/`): `npx prisma generate`
Expected: "Generated Prisma Client" with no errors.

Run (in `backend/`): `npx prisma validate`
Expected: "The schema at prisma\schema.prisma is valid".

Run (in `backend/`): `npm test`
Expected: the whole suite passes.

- [ ] **Step 4: Commit**

```bash
git -c safe.directory='*' add backend/migrations/manual/005_sessions.sql backend/prisma/schema.prisma
git -c safe.directory='*' commit -q -F - <<'EOF'
Add Sesion table for server-side refresh sessions

Migration 005 must be applied to production before deploying code that uses it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Session service

**Files:**
- Create: `backend/src/services/session.service.js`, `backend/src/lib/sessions.js`
- Test: `backend/src/services/session.service.test.js`

**Interfaces:**
- Consumes: `prisma.sesion` (Task 2).
- Produces:
  - `createSessionService({ db, now?, newId?, ttlMs?, graceMs? })` returning:
    - `start(usuarioId): Promise<{ sid: string, expiresAt: Date }>`
    - `rotate(sid): Promise<{ ok: true, usuarioId: string, sid: string } | { ok: false, reason: 'invalid' | 'reuse' }>`
    - `end(sid): Promise<void>` (ignores a missing or undefined sid)
    - `endAll(usuarioId): Promise<void>`
  - `createPrismaSessionDb(prisma)` returning the `db` object: `createSession({ id, usuarioId, expiresAt })`, `findSession(id)`, `claimRotation(id, at): Promise<boolean>`, `deleteSession(id)`, `deleteAllForUser(usuarioId)`, `deleteExpired(usuarioId, at)`.
  - `SESSION_TTL_MS` (604800000), `ROTATION_GRACE_MS` (10000).
  - `backend/src/lib/sessions.js` exports `sessions`, the instance every controller imports.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/services/session.service.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionService, SESSION_TTL_MS, ROTATION_GRACE_MS } from './session.service.js'

function makeFake() {
  const rows = new Map()
  let n = 0
  const state = { clock: new Date('2026-09-20T12:00:00Z') }
  const db = {
    createSession: async ({ id, usuarioId, expiresAt }) => { rows.set(id, { id, usuarioId, expiresAt, rotatedAt: null }) },
    findSession: async id => (rows.has(id) ? { ...rows.get(id) } : null),
    claimRotation: async (id, at) => {
      const r = rows.get(id)
      if (!r || r.rotatedAt) return false
      r.rotatedAt = at
      return true
    },
    deleteSession: async id => { rows.delete(id) },
    deleteAllForUser: async usuarioId => { for (const [k, r] of rows) if (r.usuarioId === usuarioId) rows.delete(k) },
    deleteExpired: async (usuarioId, at) => { for (const [k, r] of rows) if (r.usuarioId === usuarioId && r.expiresAt <= at) rows.delete(k) },
  }
  const service = createSessionService({ db, now: () => state.clock, newId: () => `s${++n}` })
  return { service, rows, state }
}
const advance = (state, ms) => { state.clock = new Date(state.clock.getTime() + ms) }

test('start creates a session that lasts 7 days', async () => {
  const { service, rows, state } = makeFake()
  const { sid, expiresAt } = await service.start('u1')
  assert.equal(sid, 's1')
  assert.equal(expiresAt.getTime(), state.clock.getTime() + SESSION_TTL_MS)
  assert.equal(rows.get('s1').usuarioId, 'u1')
})

test('start removes that user\'s expired sessions and leaves other users alone', async () => {
  const { service, rows, state } = makeFake()
  await service.start('u1')
  await service.start('u2')
  advance(state, SESSION_TTL_MS + 1000)
  await service.start('u1')
  assert.equal(rows.has('s1'), false)
  assert.equal(rows.has('s2'), true)
  assert.equal(rows.has('s3'), true)
})

test('a fresh session rotates once into a new one', async () => {
  const { service, rows } = makeFake()
  const { sid } = await service.start('u1')
  const res = await service.rotate(sid)
  assert.deepEqual(res, { ok: true, usuarioId: 'u1', sid: 's2' })
  assert.notEqual(rows.get('s1').rotatedAt, null)
  assert.equal(rows.size, 2)
})

test('using the same session again inside the grace window works and revokes nothing', async () => {
  const { service, rows, state } = makeFake()
  const { sid } = await service.start('u1')
  await service.rotate(sid)
  advance(state, ROTATION_GRACE_MS - 1)
  const again = await service.rotate(sid)
  assert.equal(again.ok, true)
  assert.equal(again.sid, 's3')
  assert.equal(rows.size, 3)
})

test('using a rotated session after the grace window is reuse: every session of that user is deleted', async () => {
  const { service, rows, state } = makeFake()
  const { sid } = await service.start('u1')
  await service.start('u2')
  const rotated = await service.rotate(sid)
  advance(state, ROTATION_GRACE_MS + 1)
  assert.deepEqual(await service.rotate(sid), { ok: false, reason: 'reuse' })
  assert.equal(rows.has(rotated.sid), false)
  assert.equal([...rows.values()].some(r => r.usuarioId === 'u1'), false)
  assert.equal([...rows.values()].some(r => r.usuarioId === 'u2'), true)
})

test('unknown, missing and expired sessions are invalid', async () => {
  const { service, state } = makeFake()
  assert.deepEqual(await service.rotate('nope'), { ok: false, reason: 'invalid' })
  assert.deepEqual(await service.rotate(undefined), { ok: false, reason: 'invalid' })
  const { sid } = await service.start('u1')
  advance(state, SESSION_TTL_MS)
  assert.deepEqual(await service.rotate(sid), { ok: false, reason: 'invalid' })
})

test('two simultaneous rotations both succeed with different new sessions and only one claims', async () => {
  const { service, rows } = makeFake()
  const { sid } = await service.start('u1')
  const [a, b] = await Promise.all([service.rotate(sid), service.rotate(sid)])
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  assert.notEqual(a.sid, b.sid)
  assert.equal(rows.size, 3)
})

test('end deletes one session and ignores a missing id; endAll deletes them all', async () => {
  const { service, rows } = makeFake()
  await service.start('u1')
  await service.start('u1')
  await service.start('u2')
  await service.end('s1')
  await service.end(undefined)
  assert.equal(rows.size, 2)
  await service.endAll('u1')
  assert.deepEqual([...rows.keys()], ['s3'])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (in `backend/`): `node --test src/services/session.service.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `session.service.js`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/services/session.service.js`:

```js
import { randomUUID } from 'node:crypto'

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
// Two tabs (or React StrictMode) can present the same refresh cookie at nearly the same time.
// Inside this window a second use is a race, not a theft.
export const ROTATION_GRACE_MS = 10_000

const INVALID = { ok: false, reason: 'invalid' }

export function createSessionService({ db, now = () => new Date(), newId = randomUUID, ttlMs = SESSION_TTL_MS, graceMs = ROTATION_GRACE_MS }) {
  const create = async usuarioId => {
    const sid = newId()
    const expiresAt = new Date(now().getTime() + ttlMs)
    await db.createSession({ id: sid, usuarioId, expiresAt })
    return { sid, expiresAt }
  }

  return {
    async start(usuarioId) {
      await db.deleteExpired(usuarioId, now())
      return create(usuarioId)
    },

    async rotate(sid) {
      if (!sid) return INVALID
      const t = now()
      let session = await db.findSession(sid)
      if (!session || session.expiresAt <= t) return INVALID

      if (!session.rotatedAt) {
        if (await db.claimRotation(sid, t)) {
          const next = await create(session.usuarioId)
          return { ok: true, usuarioId: session.usuarioId, sid: next.sid }
        }
        session = await db.findSession(sid) // a concurrent request claimed it first
        if (!session?.rotatedAt) return INVALID
      }

      if (t.getTime() - session.rotatedAt.getTime() <= graceMs) {
        const next = await create(session.usuarioId)
        return { ok: true, usuarioId: session.usuarioId, sid: next.sid }
      }

      // A rotated token came back after the grace window: someone kept a copy. Cut every session of the user.
      await db.deleteAllForUser(session.usuarioId)
      return { ok: false, reason: 'reuse' }
    },

    end: sid => (sid ? db.deleteSession(sid) : Promise.resolve()),
    endAll: usuarioId => db.deleteAllForUser(usuarioId),
  }
}

export function createPrismaSessionDb(prisma) {
  return {
    createSession: ({ id, usuarioId, expiresAt }) => prisma.sesion.create({ data: { id, usuarioId, expiresAt } }),
    findSession: id => prisma.sesion.findUnique({ where: { id } }),
    // Only one caller can flip rotatedAt from null.
    claimRotation: async (id, at) => (await prisma.sesion.updateMany({ where: { id, rotatedAt: null }, data: { rotatedAt: at } })).count === 1,
    deleteSession: id => prisma.sesion.deleteMany({ where: { id } }),
    deleteAllForUser: usuarioId => prisma.sesion.deleteMany({ where: { usuarioId } }),
    deleteExpired: (usuarioId, at) => prisma.sesion.deleteMany({ where: { usuarioId, expiresAt: { lte: at } } }),
  }
}
```

Create `backend/src/lib/sessions.js`:

```js
import prisma from './prisma.js'
import { createSessionService, createPrismaSessionDb } from '../services/session.service.js'

export const sessions = createSessionService({ db: createPrismaSessionDb(prisma) })
```

- [ ] **Step 4: Run tests to verify they pass**

Run (in `backend/`): `node --test src/services/session.service.test.js`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/services/session.service.js backend/src/services/session.service.test.js backend/src/lib/sessions.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Add session service with rotation and reuse detection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Rate limiters

**Files:**
- Modify: `backend/src/lib/rateLimits.js`
- Test: `backend/src/lib/rateLimits.test.js`

**Interfaces:**
- Consumes: `normalizeEmail` from `backend/src/lib/email.js`; `ipKeyGenerator` exported by `express-rate-limit`.
- Produces:
  - `createLoginEmailLimiters({ shortLimit = 5, shortWindowMs = 900000, dayLimit = 15, dayWindowMs = 86400000 } = {}): [limiter, limiter]` (spread into a route).
  - `createRefreshLimiter({ limit = 60, windowMs = 900000 } = {})`.
  - `createExtractLimiter({ limit = 10, windowMs = 3600000 } = {})`, keyed by `req.user.userId` (falls back to the IP).

- [ ] **Step 1: Write the failing tests**

In `backend/src/lib/rateLimits.test.js`, change the import line to:

```js
import { createLoginLimiter, createRegisterLimiter, createLoginEmailLimiters, createRefreshLimiter, createExtractLimiter } from './rateLimits.js'
```

and change the `hit` helper inside `withServer` so it can send an email (existing calls keep working):

```js
  const hit = (password, email) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, email }) })
```

Append to the file:

```js
test('per email: the sixth failed attempt is blocked, whatever the case or spaces, and other emails are unaffected', async () => {
  await withServer(createLoginEmailLimiters(), async hit => {
    for (let i = 0; i < 5; i++) assert.equal((await hit('bad', i % 2 ? ' A@X.com ' : 'a@x.com')).status, 401)
    const blocked = await hit('bad', 'a@x.com')
    assert.equal(blocked.status, 429)
    assert.match((await blocked.json()).error, /too many/i)
    assert.equal((await hit('bad', 'b@x.com')).status, 401)
  })
})

test('per email: a locked email is blocked even with the right password', async () => {
  await withServer(createLoginEmailLimiters(), async hit => {
    for (let i = 0; i < 5; i++) await hit('bad', 'a@x.com')
    assert.equal((await hit('ok', 'a@x.com')).status, 429)
  })
})

test('per email: successful logins do not count', async () => {
  await withServer(createLoginEmailLimiters(), async hit => {
    for (let i = 0; i < 12; i++) assert.equal((await hit('ok', 'a@x.com')).status, 200)
    assert.equal((await hit('bad', 'a@x.com')).status, 401)
  })
})

test('per email: the daily tier blocks after 15 failures even when the short tier keeps resetting', async () => {
  await withServer(createLoginEmailLimiters({ shortLimit: 100, dayLimit: 3 }), async hit => {
    for (let i = 0; i < 3; i++) assert.equal((await hit('bad', 'a@x.com')).status, 401)
    assert.equal((await hit('bad', 'a@x.com')).status, 429)
  })
})

test('per email: without an email the limiter falls back to the client IP', async () => {
  await withServer(createLoginEmailLimiters(), async hit => {
    for (let i = 0; i < 5; i++) assert.equal((await hit('bad')).status, 401)
    assert.equal((await hit('bad')).status, 429)
  })
})

test('the default per-email limits are 5 per 15 minutes and 15 per day', () => {
  const [short, day] = createLoginEmailLimiters()
  assert.equal(typeof short, 'function')
  assert.equal(typeof day, 'function')
})

test('refresh allows 60 per 15 minutes', async () => {
  await withServer(createRefreshLimiter(), async hit => {
    assert.match((await hit('ok')).headers.get('ratelimit-policy') ?? '', /60;w=900/)
  })
})

test('extraction is limited per user, not per IP', async () => {
  const app = express()
  app.use((req, _res, next) => { req.user = { userId: req.headers['x-user'] }; next() })
  app.post('/extract', createExtractLimiter({ limit: 2 }), (_req, res) => res.json({ ok: true }))
  const server = app.listen(0)
  const url = `http://127.0.0.1:${server.address().port}/extract`
  const as = user => fetch(url, { method: 'POST', headers: { 'x-user': user } })
  try {
    assert.equal((await as('ana')).status, 200)
    assert.equal((await as('ana')).status, 200)
    assert.equal((await as('ana')).status, 429)
    assert.equal((await as('luis')).status, 200)
  } finally { server.close() }
})

test('the default extraction limit is 10 per hour', async () => {
  const app = express()
  app.use((req, _res, next) => { req.user = { userId: 'ana' }; next() })
  app.post('/extract', createExtractLimiter(), (_req, res) => res.json({ ok: true }))
  const server = app.listen(0)
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/extract`, { method: 'POST' })
    assert.match(res.headers.get('ratelimit-policy') ?? '', /10;w=3600/)
  } finally { server.close() }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (in `backend/`): `node --test src/lib/rateLimits.test.js`
Expected: FAIL, the new named exports do not exist.

- [ ] **Step 3: Write the implementation**

In `backend/src/lib/rateLimits.js`, change the first import to:

```js
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { normalizeEmail } from './email.js'
```

and append:

```js
// The key is the email being attacked, so guessing spread over many IPs is still counted.
const emailKey = req => {
  const email = normalizeEmail(req.body?.email)
  return email ? `email:${email}` : ipKeyGenerator(req.ip)
}

// Two tiers, failures only. Spread it into the route: router.post('/login', ...createLoginEmailLimiters(), ...)
export const createLoginEmailLimiters = ({ shortLimit = 5, shortWindowMs = 15 * 60 * 1000, dayLimit = 15, dayWindowMs = 24 * 60 * 60 * 1000 } = {}) => [
  build({ limit: shortLimit, windowMs: shortWindowMs, keyGenerator: emailKey, skipSuccessfulRequests: true }),
  build({ limit: dayLimit, windowMs: dayWindowMs, keyGenerator: emailKey, skipSuccessfulRequests: true }),
]

export const createRefreshLimiter = ({ limit = 60, windowMs = 15 * 60 * 1000 } = {}) =>
  build({ limit, windowMs })

// Document reading calls Gemini, which has a small daily quota: cap what one user can burn.
export const createExtractLimiter = ({ limit = 10, windowMs = 60 * 60 * 1000 } = {}) =>
  build({ limit, windowMs, keyGenerator: req => `user:${req.user?.userId ?? ipKeyGenerator(req.ip)}` })
```

- [ ] **Step 4: Run tests to verify they pass**

Run (in `backend/`): `node --test src/lib/rateLimits.test.js`
Expected: all rate limit tests pass (the old ones and the 9 new ones).

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/lib/rateLimits.js backend/src/lib/rateLimits.test.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Add per-email login, refresh and per-user extraction limiters

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Wire sessions and limits into the app

**Files:**
- Modify: `backend/src/controllers/auth.controller.js`, `backend/src/routes/auth.js`, `backend/src/controllers/usuarios.controller.js`, `backend/src/routes/ratecon.js`, `backend/src/routes/registration.js`

**Interfaces:**
- Consumes: `sessions` (Task 3), `signRefresh(payload, sid)` (Task 1), the limiters (Task 4).
- Produces: `logoutAll` handler and `POST /api/auth/logout-all` (requires login).

The logic is unit-tested in Tasks 1, 3 and 4. This task is wiring, verified end to end in Task 6.

- [ ] **Step 1: Imports and the dummy hash in `auth.controller.js`**

Add to the imports:

```js
import { sessions } from '../lib/sessions.js'
```

Add below `COOKIE_OPTS`:

```js
// Compared against when the email is unknown, so that path costs as much as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10)
```

- [ ] **Step 2: `login` creates a session and never skips the comparison**

Replace the body of `login` after the `select` lookup with:

```js
  // Always run a comparison: an unknown email must not answer faster than a wrong password.
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH)
  if (!user || !valid) return res.status(401).json({ error: 'Invalid credentials' })

  const payload = { userId: user.id, empresaId: user.empresaId, rol: user.rol }
  const accessToken = signAccess(payload)
  const { sid } = await sessions.start(user.id)

  res.cookie('refreshToken', signRefresh(payload, sid), COOKIE_OPTS)
  res.json({ accessToken, user: userShape(user) })
```

(This removes the old `if (!user) return ...401` line, the old `bcrypt.compare(password, user.password)` and the old `refreshToken` constant.)

- [ ] **Step 3: `register` creates a session**

In `register`, replace:

```js
  const accessToken = signAccess(payload)
  const refreshToken = signRefresh(payload)

  res.cookie('refreshToken', refreshToken, COOKIE_OPTS)
  res.status(201).json({ accessToken, user: userShape(result.usuario) })
```

with:

```js
  const accessToken = signAccess(payload)
  const { sid } = await sessions.start(result.usuario.id)

  res.cookie('refreshToken', signRefresh(payload, sid), COOKIE_OPTS)
  res.status(201).json({ accessToken, user: userShape(result.usuario) })
```

- [ ] **Step 4: `refresh` rotates the session**

Replace the whole `refresh` handler with:

```js
export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken
  if (!token) return res.status(401).json({ error: 'No refresh token' })

  let payload
  try {
    payload = verifyRefresh(token)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' })
  }

  // Tokens without a jti come from before sessions existed and are rejected here too.
  const rotated = await sessions.rotate(payload.jti)
  if (!rotated.ok) {
    res.clearCookie('refreshToken', COOKIE_OPTS)
    return res.status(401).json({ error: 'Session expired, please log in again' })
  }

  const user = await prisma.usuario.findUnique({
    where: { id: rotated.usuarioId },
    select: { id: true, nombre: true, email: true, rol: true, empresaId: true, mustChangePassword: true },
  })
  if (!user) {
    await sessions.endAll(rotated.usuarioId)
    return res.status(401).json({ error: 'User not found' })
  }

  const fresh = { userId: user.id, empresaId: user.empresaId, rol: user.rol }
  res.cookie('refreshToken', signRefresh(fresh, rotated.sid), COOKIE_OPTS)
  res.json({ accessToken: signAccess(fresh), user: userShape(user) })
})
```

- [ ] **Step 5: `logout`, new `logoutAll`, and `changePassword`**

Replace `logout` with:

```js
export const logout = catchAsync(async (req, res) => {
  let sid
  try { sid = verifyRefresh(req.cookies?.refreshToken).jti } catch { /* no valid cookie: nothing to end */ }
  await sessions.end(sid)
  res.clearCookie('refreshToken', COOKIE_OPTS)
  res.json({ ok: true })
})

export const logoutAll = catchAsync(async (req, res) => {
  await sessions.endAll(req.user.userId)
  res.clearCookie('refreshToken', COOKIE_OPTS)
  res.json({ ok: true })
})
```

In `changePassword`, replace the update and the response with:

```js
  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.usuario.update({
    where: { id: req.user.userId },
    data: { password: hashed, mustChangePassword: false },
    select: { id: true, nombre: true, email: true, rol: true, empresaId: true, mustChangePassword: true },
  })
  // Every session opened with the old password ends. The caller gets a fresh one and stays logged in.
  await sessions.endAll(user.id)
  const { sid } = await sessions.start(user.id)
  res.cookie('refreshToken', signRefresh({ userId: user.id, empresaId: user.empresaId, rol: user.rol }, sid), COOKIE_OPTS)
  res.json({ user: userShape(user) })
```

- [ ] **Step 6: Routes**

Replace `backend/src/routes/auth.js` with:

```js
import { Router } from 'express'
import { login, register, refresh, logout, logoutAll, changePassword } from '../controllers/auth.controller.js'
import { jwtAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, registerSchema, changePasswordSchema } from '../schemas.js'
import { createLoginLimiter, createLoginEmailLimiters, createRegisterLimiter, createRefreshLimiter } from '../lib/rateLimits.js'

const router = Router()
router.post('/login', createLoginLimiter(), ...createLoginEmailLimiters(), validate(loginSchema), login)
router.post('/register', createRegisterLimiter(), validate(registerSchema), register)
router.post('/refresh', createRefreshLimiter(), refresh)
router.post('/logout', logout)
router.post('/logout-all', jwtAuth, logoutAll)
router.post('/change-password', jwtAuth, validate(changePasswordSchema), changePassword)

export default router
```

Replace `backend/src/routes/ratecon.js` with:

```js
import { Router } from 'express'
import { uploadMiddleware, extractRateCon } from '../controllers/ratecon.controller.js'
import { createExtractLimiter } from '../lib/rateLimits.js'

const router = Router()
router.post('/extract', createExtractLimiter(), uploadMiddleware, extractRateCon)
export default router
```

In `backend/src/routes/registration.js` add `import { createExtractLimiter } from '../lib/rateLimits.js'` and change the route to:

```js
router.post('/extract', createExtractLimiter(), uploadMiddleware, extractRegistrationDoc)
```

- [ ] **Step 7: Admin reset ends the target's sessions**

In `backend/src/controllers/usuarios.controller.js` add `import { sessions } from '../lib/sessions.js'` and, in `resetPassword`, right after the `prisma.usuario.update(...)` line, add:

```js
  await sessions.endAll(user.id)
```

- [ ] **Step 8: Verify**

Run (in `backend/`): `for f in src/controllers/auth.controller.js src/routes/auth.js src/routes/ratecon.js src/routes/registration.js src/controllers/usuarios.controller.js; do node --check $f || echo "FAILED $f"; done && npm test`
Expected: no `FAILED`, and the whole suite passes.

- [ ] **Step 9: Commit**

```bash
git -c safe.directory='*' add backend/src/controllers/auth.controller.js backend/src/routes/auth.js backend/src/routes/ratecon.js backend/src/routes/registration.js backend/src/controllers/usuarios.controller.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Use rotating server-side sessions and stricter login limits

- login/register start a session, refresh rotates it, logout ends it
- new POST /api/auth/logout-all
- changing or resetting a password ends the user's other sessions
- unknown emails cost the same as wrong passwords
- per-email login limits, refresh limit, per-user extraction limit

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Roll out and verify in production

**Files:**
- Temporary, never committed: `backend/_apply_sql.mjs` (delete when done)
- The verification script lives outside the repo (scratchpad).

**Interfaces:**
- Consumes: everything above. Needs the owner's admin credentials in the environment variables `TMS_EMAIL` and `TMS_PASSWORD` (never print them).

Production and development share one database. Steps 1 and 2 change production data and the deploy: get the owner's explicit OK for the migration and for the push before doing them. Warn them that everyone, including their own browser, will have to log in once more after the deploy.

- [ ] **Step 1: Apply the migration (with the owner's OK)**

Create `backend/_apply_sql.mjs`:

```js
import 'dotenv/config'
import pg from 'pg'
import { readFileSync } from 'node:fs'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
await client.query(readFileSync('migrations/manual/005_sessions.sql', 'utf8'))
const tbl = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_name = 'Sesion'`)
console.log('table Sesion:', tbl.rows.length === 1 ? 'ok' : 'MISSING')
await client.end()
```

Run (in `backend/`): `node _apply_sql.mjs` then `rm _apply_sql.mjs`
Expected: `table Sesion: ok`. Running it twice must also work (idempotent).

- [ ] **Step 2: Run everything and push (with the owner's OK)**

Run (in `backend/`): `npm test`
Expected: all pass.

Run: `git -c safe.directory='*' push origin master`

Wait for Railway. It is deployed when the refresh endpoint answers with the new limiter policy:
`curl -s -o /dev/null -D - -X POST https://fleetguardian-tms-production.up.railway.app/api/auth/refresh | tr -d '\r' | grep -i '^ratelimit-policy'`
Expected: a line containing `60;w=900`.

- [ ] **Step 3: Write and run the production verification**

Create `verify-sessions.mjs` in the scratchpad directory (it only uses `fetch`, no repo imports). It uses a throwaway user for everything that logs out or locks somebody, and the admin only to invite and delete:

```js
const API = 'https://fleetguardian-tms-production.up.railway.app'
const { TMS_EMAIL, TMS_PASSWORD } = process.env
if (!TMS_EMAIL || !TMS_PASSWORD) { console.error('Set TMS_EMAIL and TMS_PASSWORD first'); process.exit(1) }

const call = async (path, { method = 'POST', token, cookie, body } = {}) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await r.json() } catch {}
  const set = r.headers.getSetCookie().find(c => c.startsWith('refreshToken='))
  return { status: r.status, json, cookie: set ? set.split(';')[0] : null }
}
const check = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
const sleep = ms => new Promise(r => setTimeout(r, ms))

const admin = await call('/api/auth/login', { body: { email: TMS_EMAIL, password: TMS_PASSWORD } })
check('admin login works', admin.status === 200 && !!admin.cookie, `status ${admin.status}`)
if (admin.status !== 200) process.exit(1)
const adminToken = admin.json.accessToken

const email = `prueba.sesiones.${Date.now()}@example.com`
const inv = await call('/api/usuarios', { token: adminToken, body: { nombre: 'Prueba Sesiones', email, rol: 'viewer' } })
check('invite throwaway user', inv.status === 201, `status ${inv.status}`)
const userId = inv.json.id
try {
  let pw = inv.json.tempPassword
  const s1 = await call('/api/auth/login', { body: { email, password: pw } })
  check('throwaway login sets a refresh cookie', s1.status === 200 && !!s1.cookie)

  // Rotation
  const r1 = await call('/api/auth/refresh', { cookie: s1.cookie })
  check('refresh rotates the cookie', r1.status === 200 && !!r1.cookie && r1.cookie !== s1.cookie, `status ${r1.status}`)
  const r1b = await call('/api/auth/refresh', { cookie: s1.cookie })
  check('the same cookie used again right away is tolerated (grace window)', r1b.status === 200, `status ${r1b.status}`)

  // Reuse detection
  await sleep(11000)
  const reuse = await call('/api/auth/refresh', { cookie: s1.cookie })
  check('the same cookie after the grace window is rejected as reuse (401)', reuse.status === 401, reuse.json?.error)
  const afterReuse = await call('/api/auth/refresh', { cookie: r1.cookie })
  check('reuse revoked the sibling sessions too (401)', afterReuse.status === 401)

  // Change password revokes other sessions but keeps the caller
  const a = await call('/api/auth/login', { body: { email, password: pw } })
  const b = await call('/api/auth/login', { body: { email, password: pw } })
  const newPw = 'Nueva-Clave-12345'
  const ch = await call('/api/auth/change-password', { token: a.json.accessToken, cookie: a.cookie, body: { password: newPw, confirmPassword: newPw } })
  check('change password works and returns a fresh cookie', ch.status === 200 && !!ch.cookie, `status ${ch.status}`)
  pw = newPw
  const other = await call('/api/auth/refresh', { cookie: b.cookie })
  check('another session opened before the change is rejected (401)', other.status === 401)
  const kept = await call('/api/auth/refresh', { cookie: ch.cookie })
  check('the caller session survives the change', kept.status === 200)

  // logout-all
  const c = await call('/api/auth/login', { body: { email, password: pw } })
  const all = await call('/api/auth/logout-all', { token: c.json.accessToken })
  check('logout-all answers 200', all.status === 200)
  const dead = await call('/api/auth/refresh', { cookie: c.cookie })
  check('after logout-all the cookie is rejected (401)', dead.status === 401)

  // Old tokens without jti are gone: a made-up cookie is rejected
  const fake = await call('/api/auth/refresh', { cookie: 'refreshToken=not.a.jwt' })
  check('a malformed cookie is rejected (401)', fake.status === 401)

  // Lockout per email (last, it locks the throwaway user)
  const statuses = []
  for (let i = 0; i < 6; i++) statuses.push((await call('/api/auth/login', { body: { email, password: 'wrong-password' } })).status)
  check('five wrong passwords give 401 and the sixth gives 429', statuses.slice(0, 5).every(s => s === 401) && statuses[5] === 429, statuses.join(' '))
  const locked = await call('/api/auth/login', { body: { email, password: pw } })
  check('a locked email is refused even with the right password (429)', locked.status === 429)
} finally {
  const del = await call(`/api/usuarios/${userId}`, { method: 'DELETE', token: adminToken })
  check('throwaway user deleted', del.status === 200, `status ${del.status}`)
}
```

Run: `TMS_EMAIL=... TMS_PASSWORD=... node <scratchpad>/verify-sessions.mjs`, passing the credentials as environment variables and never echoing them.
Expected: every line `PASS`. The lockout part adds about 8 failed attempts from this machine to the per-IP login limit (10 per 15 minutes): do not run it twice within 15 minutes. If a line fails, stop and debug (superpowers:systematic-debugging) before continuing.

- [ ] **Step 4: Ask the owner to check their own browser**

Ask the owner to log in again (their old session was cleared by the deploy), use the app for a minute, reload the page a couple of times and confirm they stay logged in. Then ask them to click log out and log in again.

---

### Task 7: Update the docs

**Files:**
- Modify: `docs/superpowers/specs/2026-09-20-forgot-password-design.md`, `docs/superpowers/plans/2026-09-20-forgot-password.md`, `docs/plan-mejoras-tms.html` (untracked, not committed)

- [ ] **Step 1: Revision note at the top of the forgot-password spec**

Insert right after the `Status:` line of `docs/superpowers/specs/2026-09-20-forgot-password-design.md`:

```markdown

> **Revised 2026-09-20:** sessions are now server-side (`Sesion` table and `sessions` service, see `2026-09-20-sessions-and-login-limits-design.md`). `Usuario.passwordChangedAt`, `isRefreshRevoked` and the refresh check described below are NOT built. Confirming a reset calls `sessions.endAll(usuarioId)` after changing the password, and `changePassword` and the admin reset already end sessions. Read every mention of `passwordChangedAt` below with that in mind.
```

- [ ] **Step 2: Revision note at the top of the forgot-password plan**

Insert right after the first heading of `docs/superpowers/plans/2026-09-20-forgot-password.md`:

```markdown

> **Revised 2026-09-20 (sessions are server-side now):** skip Task 3 (`lib/session.js`) and Task 7 entirely. In Task 4 drop the `passwordChangedAt` column from the migration and the schema. In Task 5 remove `passwordChangedAt` from `consumeToken`'s user update, give `createPasswordResetService` a `sessions` dependency (`import { sessions } from '../lib/sessions.js'` in the controller) and call `await sessions.endAll(record.usuarioId)` at the end of `confirmReset`, with a test that a fake `sessions.endAll` is called with the user id. In Task 9 the verification must check that a refresh cookie opened before the reset is rejected with 401. Migration numbers: this plan's migration becomes `006_password_reset.sql`.
```

- [ ] **Step 3: Mark day 2 in the HTML plan**

In `docs/plan-mejoras-tms.html`, replace these day 2 task strings (keep the surrounding quotes and commas):

- `'Agregar helmet y un límite de intentos por IP y por email en login, registro, refresh y lectura de rate-cons (hecho el 20 sept: helmet y límite por IP en login y registro, con trust proxy; falta por email, refresh y rate-cons)'` becomes `'Agregar helmet y un límite de intentos por IP y por email en login, registro, refresh y lectura de rate-cons (hecho el 20 sept)'`
- `'Bloqueo progresivo tras varios intentos fallidos'` becomes `'Bloqueo progresivo tras varios intentos fallidos (hecho el 20 sept: 5 cada 15 min y 15 al día por email)'`
- `'Comparar siempre la contraseña (hash de relleno si el usuario no existe) para no revelar quién tiene cuenta'` becomes `'Comparar siempre la contraseña (hash de relleno si el usuario no existe) para no revelar quién tiene cuenta (hecho el 20 sept)'`
- `'Agregar tokenVersion al usuario: subirlo al cambiar contraseña o cerrar sesión en todos lados, y rechazar refresh tokens viejos'` becomes `'Sesiones en la base de datos (tabla Sesion) en lugar de tokenVersion: cambiar la contraseña o cerrar sesión en todos lados las borra y los refresh tokens viejos se rechazan (hecho el 20 sept)'`
- `'Rotar el refresh token en cada uso'` becomes `'Rotar el refresh token en cada uso, con detección de reutilización (hecho el 20 sept)'`

Only do this step after Task 6 step 3 passed.

Run: `node -e "const h=require('fs').readFileSync('docs/plan-mejoras-tms.html','utf8');const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');require('fs').writeFileSync(process.env.TEMP+'/plan_check.js',s)" && node --check "$TEMP/plan_check.js" && echo js-ok`
Expected: `js-ok`.

- [ ] **Step 4: Commit the two markdown files and update memory**

```bash
git -c safe.directory='*' add docs/superpowers/specs/2026-09-20-forgot-password-design.md docs/superpowers/plans/2026-09-20-forgot-password.md
git -c safe.directory='*' commit -q -F - <<'EOF'
Point the forgot-password docs at the new session model

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

Update the project memory file `tms-day1-security-progress.md`: day 2 done (sessions table with rotation, per-email limits), migration 005 applied to production, forgot-password docs revised, day 16 still pending on the domain.

---

## Self-Review

**Spec coverage:** data and migration (Task 2, applied in Task 6); `jti` in the refresh token (Task 1); session service with start, rotate (claim, grace, reuse), end, endAll (Task 3); login, register, refresh, logout, `logout-all`, change password and admin reset wiring, dummy hash, and rejection of tokens without `jti` (Task 5); per-email tiers, refresh limit and per-user extraction limit (Tasks 4 and 5); tests listed in the spec (Tasks 1, 3, 4) and the production script (Task 6); deploy order and its effect on users (Task 6); docs to update (Task 7). Out-of-scope items are not planned.

**Placeholders:** none. Task 7 step 2 is a revision note that precisely lists what to change in the other plan when it is executed.

**Types:** `createSessionService`, `createPrismaSessionDb`, `sessions`, `start`, `rotate`, `end`, `endAll`, `SESSION_TTL_MS`, `ROTATION_GRACE_MS`, `signRefresh(payload, sid)`, `createLoginEmailLimiters`, `createRefreshLimiter`, `createExtractLimiter`, `logoutAll` are defined once and used with the same names and signatures. The `db` method names match between the fake in the tests and `createPrismaSessionDb`.
