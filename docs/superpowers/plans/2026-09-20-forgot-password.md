# Forgot Password Implementation Plan

> **Revised 2026-09-20 (sessions are server-side now, already in production):** skip Task 3 (`lib/session.js`) and Task 7 entirely. In Task 4 drop the `passwordChangedAt` column from the migration and the schema, and name the migration `007_password_reset.sql` (005 is the sessions table, 006 the environment marker). In Task 5 remove `passwordChangedAt` from `consumeToken`'s user update, give `createPasswordResetService` a `sessions` dependency (the controller passes `sessions` from `../lib/sessions.js`) and call `await sessions.endAll(record.usuarioId)` at the end of `confirmReset`, with a test that a fake `sessions.endAll` is called with the user id. In Task 9 the verification must check that a refresh cookie opened before the reset is rejected with 401. The `POST /api/auth/refresh` handler and `changePassword` already use sessions, do not touch them.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user who forgot their password can set a new one from the login screen, and sessions opened with the old password stop working.

**Architecture:** A `PasswordResetToken` table stores only the SHA-256 hash of a random one-time token. A small service (database and mailer injected, so it is unit-testable) creates and consumes tokens. Mail goes through a `sendMail` interface whose only provider for now is `log`. Sessions are revoked at refresh time by comparing the refresh token's `iat` with a new `Usuario.passwordChangedAt`.

**Tech Stack:** Node 25, Express 5, Prisma 7 (PrismaPg adapter, PostgreSQL), Zod 4, bcryptjs, `node:test`; React 19 + Vite frontend with axios and react-router.

**Spec:** `docs/superpowers/specs/2026-09-20-forgot-password-design.md`

## Global Constraints

- Reset token: 32 random bytes, base64url (43 chars). Stored as SHA-256 hex only, never the token itself.
- Token lifetime: 1 hour. A token can be used once. A new request deletes that user's unused tokens.
- `POST /api/auth/forgot-password` always answers 200 with the same message, whether or not the email exists, and does not `await` the mail sending.
- Rate limits, per IP: forgot-password 5 per hour, reset-password 10 per hour (both count every request).
- New password: at least 8 characters and equal to `confirmPassword`.
- `MAIL_PROVIDER` defaults to `log`. An unknown provider must fail at boot (through `validateEnv`).
- Session revocation compares in whole seconds: reject when `payload.iat < Math.floor(passwordChangedAt / 1000)`.
- The migration is additive and idempotent, and must be applied to production BEFORE the backend code is pushed (Prisma selects every column).
- Repo rules: run backend tests with `npm test` inside `backend/` (never `node --test src/`, it boots the real server against the shared production DB). Git needs `git -c safe.directory='*'`. Commit messages end with a blank line and `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Do not push unless the user asks. Frontend copy is in English like `ChangePassword.jsx`.
- ES modules with explicit `.js` extensions in imports. Match the surrounding code style (no semicolons, single quotes).

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/lib/resetToken.js` (new) | Generate and hash reset tokens |
| `backend/src/lib/mailer.js` (new) | `getMailer()` returns `{ sendMail }` for the configured provider |
| `backend/src/lib/session.js` (new) | `isRefreshRevoked(iat, passwordChangedAt)` |
| `backend/src/services/passwordReset.service.js` (new) | `createPasswordResetService`, `createPrismaResetDb` |
| `backend/migrations/manual/004_password_reset.sql` (new) | Table and column |
| `backend/prisma/schema.prisma` | Model and field |
| `backend/src/lib/env.js` | Validate `MAIL_PROVIDER` at boot |
| `backend/src/lib/rateLimits.js` | Two new limiters |
| `backend/src/schemas.js` | Two new Zod schemas |
| `backend/src/controllers/auth.controller.js` | New handlers, session rules in `refresh` and `changePassword` |
| `backend/src/routes/auth.js` | Two new routes |
| `backend/src/controllers/usuarios.controller.js` | Admin reset sets `passwordChangedAt` |
| `frontend/src/api/auth.api.js` | Two new calls |
| `frontend/src/pages/ForgotPassword.jsx`, `ResetPassword.jsx` (new) | The two public pages |
| `frontend/src/pages/Login.jsx`, `frontend/src/App.jsx` | Link and routes |

---

### Task 1: Reset token helpers

**Files:**
- Create: `backend/src/lib/resetToken.js`
- Test: `backend/src/lib/resetToken.test.js`

**Interfaces:**
- Produces: `generateToken(): { token: string, tokenHash: string }`, `hashToken(token: string): string`, `RESET_TOKEN_TTL_MS: number` (3600000)

- [ ] **Step 1: Write the failing test**

Create `backend/src/lib/resetToken.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { generateToken, hashToken, RESET_TOKEN_TTL_MS } from './resetToken.js'

test('a token is 43 url-safe characters (32 random bytes) and never repeats', () => {
  const tokens = Array.from({ length: 50 }, () => generateToken().token)
  for (const t of tokens) assert.match(t, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(new Set(tokens).size, 50)
})

test('tokenHash is the sha256 hex of the token and is not the token', () => {
  const { token, tokenHash } = generateToken()
  assert.equal(tokenHash, createHash('sha256').update(token).digest('hex'))
  assert.notEqual(tokenHash, token)
  assert.match(tokenHash, /^[0-9a-f]{64}$/)
})

test('hashToken is deterministic', () => {
  assert.equal(hashToken('abc'), hashToken('abc'))
  assert.notEqual(hashToken('abc'), hashToken('abd'))
})

test('a reset token lives one hour', () => {
  assert.equal(RESET_TOKEN_TTL_MS, 60 * 60 * 1000)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `backend/`): `node --test src/lib/resetToken.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `resetToken.js`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/lib/resetToken.js`:

```js
import { randomBytes, createHash } from 'node:crypto'

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

export const hashToken = token => createHash('sha256').update(token).digest('hex')

// The token goes in the email link; only its hash is stored, so a database leak cannot be used to reset accounts.
export function generateToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (in `backend/`): `node --test src/lib/resetToken.test.js`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/lib/resetToken.js backend/src/lib/resetToken.test.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Add password reset token helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Mailer interface and boot validation

**Files:**
- Create: `backend/src/lib/mailer.js`
- Modify: `backend/src/lib/env.js`
- Test: `backend/src/lib/mailer.test.js`, `backend/src/lib/env.test.js`

**Interfaces:**
- Produces: `getMailer(env = process.env): { sendMail({ to, subject, text }): Promise<void> }`. Throws `Unknown MAIL_PROVIDER "<name>". Available: log` for an unknown provider.
- `validateEnv` now also throws for an unknown `MAIL_PROVIDER`.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/lib/mailer.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getMailer } from './mailer.js'

test('the log provider is the default', () => {
  assert.equal(typeof getMailer({}).sendMail, 'function')
  assert.equal(typeof getMailer({ MAIL_PROVIDER: 'log' }).sendMail, 'function')
})

test('the log provider prints recipient, subject and body', async () => {
  const lines = []
  const original = console.log
  console.log = (...args) => lines.push(args.join(' '))
  try {
    await getMailer({}).sendMail({ to: 'ana@example.com', subject: 'Hello', text: 'the body' })
  } finally {
    console.log = original
  }
  const out = lines.join('\n')
  assert.match(out, /ana@example\.com/)
  assert.match(out, /Hello/)
  assert.match(out, /the body/)
})

test('an unknown provider throws and names the options', () => {
  assert.throws(() => getMailer({ MAIL_PROVIDER: 'smtpx' }), /Unknown MAIL_PROVIDER "smtpx"\. Available: log/)
})
```

Append to `backend/src/lib/env.test.js`:

```js
test('validateEnv rejects an unknown MAIL_PROVIDER', () => {
  assert.throws(() => validateEnv({ ...full, MAIL_PROVIDER: 'nope' }), /MAIL_PROVIDER/)
})

test('validateEnv accepts the log provider', () => {
  assert.doesNotThrow(() => validateEnv({ ...full, MAIL_PROVIDER: 'log' }))
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (in `backend/`): `node --test src/lib/mailer.test.js src/lib/env.test.js`
Expected: `mailer.test.js` fails with `ERR_MODULE_NOT_FOUND`; the new `env.test.js` "unknown MAIL_PROVIDER" test fails (no throw).

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/lib/mailer.js`:

```js
// Only the log provider exists for now: the app has no email domain yet. With it, the message
// (including the reset link) is written to the server log. Add an SMTP or Resend provider here
// and select it with MAIL_PROVIDER, the callers do not change.
const providers = {
  log: async ({ to, subject, text }) => {
    console.log(`[mail:log] to=${to} subject="${subject}"\n${text}`)
  },
}

export function getMailer(env = process.env) {
  const name = env.MAIL_PROVIDER || 'log'
  const send = providers[name]
  if (!send) throw new Error(`Unknown MAIL_PROVIDER "${name}". Available: ${Object.keys(providers).join(', ')}`)
  return { sendMail: send }
}
```

Edit `backend/src/lib/env.js`: add the import at the top and the call at the end of `validateEnv`:

```js
import { getMailer } from './mailer.js'
```

```js
export function validateEnv(env = process.env) {
  const { missing, warnings } = checkEnv(env)
  if (warnings.length) console.warn(`[env] optional variables not set (related features will fail): ${warnings.join(', ')}`)
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  getMailer(env) // throws on an unknown MAIL_PROVIDER
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (in `backend/`): `node --test src/lib/mailer.test.js src/lib/env.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/lib/mailer.js backend/src/lib/mailer.test.js backend/src/lib/env.js backend/src/lib/env.test.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Add mailer interface with a log provider

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Refresh revocation rule

**Files:**
- Create: `backend/src/lib/session.js`
- Test: `backend/src/lib/session.test.js`

**Interfaces:**
- Produces: `isRefreshRevoked(iat: number, passwordChangedAt: Date | string | null | undefined): boolean` where `iat` is the JWT `iat` claim in seconds.

- [ ] **Step 1: Write the failing test**

Create `backend/src/lib/session.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { isRefreshRevoked } from './session.js'

const changedAt = new Date('2026-09-20T12:00:00.750Z')
const changedSec = Math.floor(changedAt.getTime() / 1000)

test('a token issued before the password change is revoked', () => {
  assert.equal(isRefreshRevoked(changedSec - 1, changedAt), true)
  assert.equal(isRefreshRevoked(changedSec - 3600, changedAt), true)
})

test('a token issued in the same second as the change is kept (iat has no milliseconds)', () => {
  assert.equal(isRefreshRevoked(changedSec, changedAt), false)
})

test('a token issued after the change is kept', () => {
  assert.equal(isRefreshRevoked(changedSec + 1, changedAt), false)
})

test('users who never changed their password are never revoked', () => {
  assert.equal(isRefreshRevoked(1, null), false)
  assert.equal(isRefreshRevoked(1, undefined), false)
})

test('accepts an ISO string as well as a Date', () => {
  assert.equal(isRefreshRevoked(changedSec - 1, changedAt.toISOString()), true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `backend/`): `node --test src/lib/session.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/lib/session.js`:

```js
// JWT `iat` is whole seconds, so compare in seconds: a token issued in the same second as the
// change (for example the fresh cookie set by changePassword) must not be rejected.
export function isRefreshRevoked(iat, passwordChangedAt) {
  if (!passwordChangedAt) return false
  return iat < Math.floor(new Date(passwordChangedAt).getTime() / 1000)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (in `backend/`): `node --test src/lib/session.test.js`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/lib/session.js backend/src/lib/session.test.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Add refresh token revocation rule

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Migration and Prisma schema

**Files:**
- Create: `backend/migrations/manual/004_password_reset.sql`
- Modify: `backend/prisma/schema.prisma` (model `Usuario` at line 26, plus a new model after it)

**Interfaces:**
- Produces: table `PasswordResetToken`, column `Usuario.passwordChangedAt`, Prisma client members `prisma.passwordResetToken` and `usuario.passwordChangedAt`.

This task does NOT touch production. Applying the SQL is Task 9.

- [ ] **Step 1: Write the migration**

Create `backend/migrations/manual/004_password_reset.sql`:

```sql
-- Migration: 004_password_reset
-- Feature: forgot password (one-time reset tokens) and session revocation after a password change
-- Additive and idempotent: safe to run more than once, deletes no data.
-- Apply to EVERY environment BEFORE deploying the backend code that selects "passwordChangedAt".

ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "usuarioId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "creadoEn"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_usuarioId_idx" ON "PasswordResetToken"("usuarioId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_usuarioId_fkey') THEN
    ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
```

- [ ] **Step 2: Update the Prisma schema**

In `backend/prisma/schema.prisma`, replace the `Usuario` model with:

```prisma
model Usuario {
  id        String   @id @default(uuid())
  empresaId String
  empresa   Empresa  @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  nombre    String
  email     String   @unique
  password  String
  rol                String   @default("dispatcher")
  mustChangePassword Boolean  @default(false)
  passwordChangedAt  DateTime?
  creadoEn           DateTime @default(now())
  resetTokens        PasswordResetToken[]

  @@index([empresaId])
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  usuarioId String
  usuario   Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
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
Expected: the whole suite still passes (nothing reads the new members yet).

- [ ] **Step 4: Commit**

```bash
git -c safe.directory='*' add backend/migrations/manual/004_password_reset.sql backend/prisma/schema.prisma
git -c safe.directory='*' commit -q -F - <<'EOF'
Add password reset token table and passwordChangedAt column

Migration 004 must be applied to production before deploying code that uses it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Password reset service

**Files:**
- Create: `backend/src/services/passwordReset.service.js`
- Test: `backend/src/services/passwordReset.service.test.js`

**Interfaces:**
- Consumes: `generateToken`, `hashToken`, `RESET_TOKEN_TTL_MS` (Task 1); `normalizeEmail` from `backend/src/lib/email.js`.
- Produces:
  - `createPasswordResetService({ db, mailer, frontendUrl, hash?, now? })` returning `{ requestReset(email): Promise<void>, confirmReset(token, password): Promise<void> }`. `hash` defaults to bcrypt with 10 rounds, `now` defaults to `() => new Date()`. `confirmReset` throws an `Error` with `status = 400` and message `Invalid or expired link`.
  - `createPrismaResetDb(prisma)` returning the `db` object the service needs: `findUserByEmail(email)`, `replaceResetToken({ usuarioId, tokenHash, expiresAt })`, `findResetToken(tokenHash)`, `consumeToken({ tokenId, usuarioId, passwordHash, changedAt }): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/services/passwordReset.service.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createPasswordResetService } from './passwordReset.service.js'
import { hashToken, RESET_TOKEN_TTL_MS } from '../lib/resetToken.js'

function makeFake() {
  const users = [{ id: 'u1', email: 'ana@example.com', nombre: 'Ana' }]
  const tokens = []
  const state = { passwords: {}, sent: [], clock: new Date('2026-09-20T12:00:00Z') }
  const db = {
    findUserByEmail: async email => users.find(u => u.email === email) ?? null,
    replaceResetToken: async ({ usuarioId, tokenHash, expiresAt }) => {
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].usuarioId === usuarioId && !tokens[i].usedAt) tokens.splice(i, 1)
      }
      tokens.push({ id: `t${tokens.length + 1}`, usuarioId, tokenHash, expiresAt, usedAt: null })
    },
    findResetToken: async tokenHash => tokens.find(t => t.tokenHash === tokenHash) ?? null,
    consumeToken: async ({ tokenId, usuarioId, passwordHash, changedAt }) => {
      const t = tokens.find(x => x.id === tokenId)
      if (!t || t.usedAt) return false
      t.usedAt = changedAt
      state.passwords[usuarioId] = { passwordHash, changedAt }
      return true
    },
  }
  const mailer = { sendMail: async mail => { state.sent.push(mail) } }
  const make = overrides => createPasswordResetService({
    db, mailer, frontendUrl: 'https://app.example',
    hash: async pw => `hashed:${pw}`, now: () => state.clock, ...overrides,
  })
  return { db, tokens, state, service: make(), make }
}

const tokenFrom = mail => mail.text.match(/token=([A-Za-z0-9_-]+)/)[1]
const invalidLink = err => err.status === 400 && /Invalid or expired link/.test(err.message)

test('an unknown email sends nothing, stores nothing and does not throw', async () => {
  const { service, state, tokens } = makeFake()
  await service.requestReset('nobody@example.com')
  assert.equal(state.sent.length, 0)
  assert.equal(tokens.length, 0)
})

test('a known email gets one mail with the link and only the hash is stored', async () => {
  const { service, state, tokens } = makeFake()
  await service.requestReset('ana@example.com')
  assert.equal(state.sent.length, 1)
  assert.equal(state.sent[0].to, 'ana@example.com')
  assert.match(state.sent[0].text, /^.*https:\/\/app\.example\/reset-password\?token=/m)
  const token = tokenFrom(state.sent[0])
  assert.equal(tokens.length, 1)
  assert.notEqual(tokens[0].tokenHash, token)
  assert.equal(tokens[0].tokenHash, hashToken(token))
  assert.equal(tokens[0].expiresAt.getTime(), state.clock.getTime() + RESET_TOKEN_TTL_MS)
})

test('the email is trimmed and lower-cased before the lookup', async () => {
  const { service, state } = makeFake()
  await service.requestReset('  ANA@Example.com ')
  assert.equal(state.sent.length, 1)
})

test('a second request replaces the first token, which stops working', async () => {
  const { service, state, tokens } = makeFake()
  await service.requestReset('ana@example.com')
  await service.requestReset('ana@example.com')
  assert.equal(tokens.length, 1)
  await assert.rejects(service.confirmReset(tokenFrom(state.sent[0]), 'NewPass123'), invalidLink)
  await service.confirmReset(tokenFrom(state.sent[1]), 'NewPass123')
})

test('a valid token changes the password, records the time and marks the token used', async () => {
  const { service, state, tokens } = makeFake()
  await service.requestReset('ana@example.com')
  await service.confirmReset(tokenFrom(state.sent[0]), 'NewPass123')
  assert.deepEqual(state.passwords.u1, { passwordHash: 'hashed:NewPass123', changedAt: state.clock })
  assert.equal(tokens[0].usedAt, state.clock)
})

test('a token cannot be used twice', async () => {
  const { service, state } = makeFake()
  await service.requestReset('ana@example.com')
  const token = tokenFrom(state.sent[0])
  await service.confirmReset(token, 'NewPass123')
  await assert.rejects(service.confirmReset(token, 'Another456'), invalidLink)
})

test('an expired token is rejected', async () => {
  const { service, state } = makeFake()
  await service.requestReset('ana@example.com')
  state.clock = new Date(state.clock.getTime() + RESET_TOKEN_TTL_MS + 1000)
  await assert.rejects(service.confirmReset(tokenFrom(state.sent[0]), 'NewPass123'), invalidLink)
  assert.equal(state.passwords.u1, undefined)
})

test('an unknown token is rejected with status 400', async () => {
  const { service } = makeFake()
  await assert.rejects(service.confirmReset('not-a-real-token', 'NewPass123'), invalidLink)
})

test('losing the race for the token is rejected too', async () => {
  const { service, state, db, make } = makeFake()
  await service.requestReset('ana@example.com')
  const token = tokenFrom(state.sent[0])
  await service.confirmReset(token, 'NewPass123')
  // A second request that read the token just before the first one consumed it.
  const stale = make({ db: { ...db, findResetToken: async h => ({ ...(await db.findResetToken(h)), usedAt: null }) } })
  await assert.rejects(stale.confirmReset(token, 'Another456'), invalidLink)
})

test('a failure while sending the mail surfaces to the caller', async () => {
  const { make } = makeFake()
  const broken = make({ mailer: { sendMail: async () => { throw new Error('smtp down') } } })
  await assert.rejects(broken.requestReset('ana@example.com'), /smtp down/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (in `backend/`): `node --test src/services/passwordReset.service.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `passwordReset.service.js`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/services/passwordReset.service.js`:

```js
import bcrypt from 'bcryptjs'
import { generateToken, hashToken, RESET_TOKEN_TTL_MS } from '../lib/resetToken.js'
import { normalizeEmail } from '../lib/email.js'

const invalidLink = () => Object.assign(new Error('Invalid or expired link'), { status: 400 })

export function createPasswordResetService({ db, mailer, frontendUrl, hash = pw => bcrypt.hash(pw, 10), now = () => new Date() }) {
  return {
    // Resolves quietly for unknown emails: the caller must not learn which addresses have an account.
    async requestReset(email) {
      const user = await db.findUserByEmail(normalizeEmail(email))
      if (!user) return
      const { token, tokenHash } = generateToken()
      await db.replaceResetToken({ usuarioId: user.id, tokenHash, expiresAt: new Date(now().getTime() + RESET_TOKEN_TTL_MS) })
      const link = `${frontendUrl}/reset-password?token=${token}`
      await mailer.sendMail({
        to: user.email,
        subject: 'Reset your Fleet Guardian password',
        text: `Hi ${user.nombre},\n\nUse this link to choose a new password. It works once and expires in 1 hour:\n${link}\n\nIf you did not ask for this, you can ignore this message.`,
      })
    },

    async confirmReset(token, password) {
      const record = await db.findResetToken(hashToken(String(token)))
      const changedAt = now()
      if (!record || record.usedAt || record.expiresAt <= changedAt) throw invalidLink()
      const ok = await db.consumeToken({
        tokenId: record.id,
        usuarioId: record.usuarioId,
        passwordHash: await hash(password),
        changedAt,
      })
      if (!ok) throw invalidLink()
    },
  }
}

export function createPrismaResetDb(prisma) {
  return {
    findUserByEmail: email => prisma.usuario.findUnique({ where: { email }, select: { id: true, email: true, nombre: true } }),

    replaceResetToken: ({ usuarioId, tokenHash, expiresAt }) => prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { usuarioId, usedAt: null } }),
      prisma.passwordResetToken.create({ data: { usuarioId, tokenHash, expiresAt } }),
    ]),

    findResetToken: tokenHash => prisma.passwordResetToken.findUnique({ where: { tokenHash } }),

    // Claims the token first (only one caller can flip usedAt from null), then changes the password.
    consumeToken: ({ tokenId, usuarioId, passwordHash, changedAt }) => prisma.$transaction(async tx => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: tokenId, usedAt: null }, data: { usedAt: changedAt } })
      if (claimed.count === 0) return false
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { password: passwordHash, mustChangePassword: false, passwordChangedAt: changedAt },
      })
      return true
    }),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (in `backend/`): `node --test src/services/passwordReset.service.test.js`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/services/passwordReset.service.js backend/src/services/passwordReset.service.test.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Add password reset service

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Endpoints, schemas and rate limits

**Files:**
- Modify: `backend/src/lib/rateLimits.js`, `backend/src/schemas.js`, `backend/src/controllers/auth.controller.js`, `backend/src/routes/auth.js`
- Test: `backend/src/lib/rateLimits.test.js`

**Interfaces:**
- Consumes: `createPasswordResetService`, `createPrismaResetDb` (Task 5); `getMailer` (Task 2); `prisma` default export from `backend/src/lib/prisma.js`.
- Produces: `createForgotPasswordLimiter({ limit = 5, windowMs = 3600000 } = {})`, `createResetPasswordLimiter({ limit = 10, windowMs = 3600000 } = {})`; schemas `forgotPasswordSchema`, `resetPasswordSchema`; handlers `forgotPassword`, `confirmPasswordReset`; routes `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`.

- [ ] **Step 1: Write the failing test**

Edit the import line at the top of `backend/src/lib/rateLimits.test.js`:

```js
import { createLoginLimiter, createRegisterLimiter, createForgotPasswordLimiter, createResetPasswordLimiter } from './rateLimits.js'
```

Append to the same file:

```js
test('forgot-password allows 5 per hour and reset-password 10 per hour, counting every request', async () => {
  await withServer(createForgotPasswordLimiter(), async hit => {
    assert.match((await hit('ok')).headers.get('ratelimit-policy') ?? '', /5;w=3600/)
  })
  await withServer(createResetPasswordLimiter(), async hit => {
    assert.match((await hit('ok')).headers.get('ratelimit-policy') ?? '', /10;w=3600/)
  })
  await withServer(createForgotPasswordLimiter({ limit: 2 }), async hit => {
    assert.equal((await hit('ok')).status, 200)
    assert.equal((await hit('ok')).status, 200)
    assert.equal((await hit('ok')).status, 429)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `backend/`): `node --test src/lib/rateLimits.test.js`
Expected: FAIL, the new named exports do not exist.

- [ ] **Step 3: Implement the limiters**

Append to `backend/src/lib/rateLimits.js`:

```js
export const createForgotPasswordLimiter = ({ limit = 5, windowMs = 60 * 60 * 1000 } = {}) =>
  build({ limit, windowMs })

export const createResetPasswordLimiter = ({ limit = 10, windowMs = 60 * 60 * 1000 } = {}) =>
  build({ limit, windowMs })
```

- [ ] **Step 4: Run test to verify it passes**

Run (in `backend/`): `node --test src/lib/rateLimits.test.js`
Expected: all rate limit tests pass.

- [ ] **Step 5: Add the schemas**

In `backend/src/schemas.js`, add after `changePasswordSchema`:

```js
export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Valid email required' }),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'Token required' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })
```

- [ ] **Step 6: Add the handlers**

In `backend/src/controllers/auth.controller.js`, add to the imports:

```js
import { getMailer } from '../lib/mailer.js'
import { createPasswordResetService, createPrismaResetDb } from '../services/passwordReset.service.js'
```

Add below `userShape`:

```js
const FORGOT_MESSAGE = 'If that email has an account, we sent instructions to reset the password.'

// Built on first use so a bad MAIL_PROVIDER is reported by validateEnv at boot, not at import time.
let resetService
function getResetService() {
  resetService ??= createPasswordResetService({
    db: createPrismaResetDb(prisma),
    mailer: getMailer(),
    frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, ''),
  })
  return resetService
}
```

Add at the end of the file:

```js
export const forgotPassword = catchAsync(async (req, res) => {
  // Not awaited on purpose: the response time must not reveal whether the email has an account.
  getResetService().requestReset(req.body.email).catch(err => console.error('[forgot-password]', err))
  res.json({ message: FORGOT_MESSAGE })
})

export const confirmPasswordReset = catchAsync(async (req, res) => {
  await getResetService().confirmReset(req.body.token, req.body.password)
  res.json({ ok: true })
})
```

- [ ] **Step 7: Add the routes**

Replace `backend/src/routes/auth.js` with:

```js
import { Router } from 'express'
import { login, register, refresh, logout, changePassword, forgotPassword, confirmPasswordReset } from '../controllers/auth.controller.js'
import { jwtAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, registerSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas.js'
import { createLoginLimiter, createRegisterLimiter, createForgotPasswordLimiter, createResetPasswordLimiter } from '../lib/rateLimits.js'

const router = Router()
router.post('/login', createLoginLimiter(), validate(loginSchema), login)
router.post('/register', createRegisterLimiter(), validate(registerSchema), register)
router.post('/forgot-password', createForgotPasswordLimiter(), validate(forgotPasswordSchema), forgotPassword)
router.post('/reset-password', createResetPasswordLimiter(), validate(resetPasswordSchema), confirmPasswordReset)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.post('/change-password', jwtAuth, validate(changePasswordSchema), changePassword)

export default router
```

- [ ] **Step 8: Verify the whole backend**

Run (in `backend/`): `node --check src/controllers/auth.controller.js && node --check src/routes/auth.js && npm test`
Expected: no syntax errors and the whole suite passes.

- [ ] **Step 9: Commit**

```bash
git -c safe.directory='*' add backend/src/lib/rateLimits.js backend/src/lib/rateLimits.test.js backend/src/schemas.js backend/src/controllers/auth.controller.js backend/src/routes/auth.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Add forgot-password and reset-password endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Revoke old sessions on password change

**Files:**
- Modify: `backend/src/controllers/auth.controller.js` (`refresh`, `changePassword`), `backend/src/controllers/usuarios.controller.js` (`resetPassword`)

**Interfaces:**
- Consumes: `isRefreshRevoked` (Task 3); `passwordChangedAt` column (Task 4); `signRefresh` and `COOKIE_OPTS` already in `auth.controller.js`.

The rule itself is unit-tested (Task 3). These are wiring changes verified end to end in Task 9.

- [ ] **Step 1: Reject revoked refresh tokens**

In `backend/src/controllers/auth.controller.js` add to the imports:

```js
import { isRefreshRevoked } from '../lib/session.js'
```

In `refresh`, change the `select` to include `passwordChangedAt` and add the check after the "User not found" line:

```js
  const user = await prisma.usuario.findUnique({
    where: { id: payload.userId },
    select: { id: true, nombre: true, email: true, rol: true, empresaId: true, mustChangePassword: true, passwordChangedAt: true },
  })
  if (!user) return res.status(401).json({ error: 'User not found' })
  if (isRefreshRevoked(payload.iat, user.passwordChangedAt)) return res.status(401).json({ error: 'Session expired, please log in again' })
```

- [ ] **Step 2: Make `changePassword` revoke old sessions and keep the current one**

Replace the update part of `changePassword` with:

```js
  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.usuario.update({
    where: { id: req.user.userId },
    data: { password: hashed, mustChangePassword: false, passwordChangedAt: new Date() },
    select: { id: true, nombre: true, email: true, rol: true, empresaId: true, mustChangePassword: true },
  })
  // Other sessions are now revoked; give this one a fresh refresh cookie so the user stays logged in.
  res.cookie('refreshToken', signRefresh({ userId: user.id, empresaId: user.empresaId, rol: user.rol }), COOKIE_OPTS)
  res.json({ user: userShape(user) })
```

- [ ] **Step 3: Make the admin reset revoke the target's sessions**

In `backend/src/controllers/usuarios.controller.js`, inside `resetPassword`, change the update to:

```js
  await prisma.usuario.update({ where: { id: user.id }, data: { password: hashed, mustChangePassword: true, passwordChangedAt: new Date() } })
```

- [ ] **Step 4: Verify**

Run (in `backend/`): `node --check src/controllers/auth.controller.js && node --check src/controllers/usuarios.controller.js && npm test`
Expected: no syntax errors and the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory='*' add backend/src/controllers/auth.controller.js backend/src/controllers/usuarios.controller.js
git -c safe.directory='*' commit -q -F - <<'EOF'
Revoke old sessions when a password changes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Frontend pages

**Files:**
- Modify: `frontend/src/api/auth.api.js`, `frontend/src/pages/Login.jsx`, `frontend/src/App.jsx`
- Create: `frontend/src/pages/ForgotPassword.jsx`, `frontend/src/pages/ResetPassword.jsx`

**Interfaces:**
- Consumes: `POST /api/auth/forgot-password { email }` → `{ message }`; `POST /api/auth/reset-password { token, password, confirmPassword }` → `{ ok: true }` or `{ error }` with 400/429.
- Produces: `authApi.forgotPassword(email)`, `authApi.resetPassword(token, password, confirmPassword)`; routes `/forgot-password` and `/reset-password` (public).

The frontend has no component test setup (its tests are pure utility tests), so this task is checked with lint, build and the browser check in Task 9.

- [ ] **Step 1: API calls**

In `frontend/src/api/auth.api.js`, add before the closing `}` of `authApi` (these are public endpoints, so they use plain `axios`, like `login`):

```js
  forgotPassword: async (email) => {
    const { data } = await axios.post(`${API_URL}/api/auth/forgot-password`, { email })
    return data
  },
  resetPassword: async (token, password, confirmPassword) => {
    const { data } = await axios.post(`${API_URL}/api/auth/reset-password`, { token, password, confirmPassword })
    return data
  },
```

- [ ] **Step 2: Forgot password page**

Create `frontend/src/pages/ForgotPassword.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/auth.api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not send the request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-gold">Fleet Guardian</h1>
          <p className="text-text-muted text-sm mt-2">Reset your password</p>
        </div>
        <div className="bg-surface border border-border-dim rounded-2xl p-8 space-y-5">
          {sent ? (
            <p className="text-text-muted text-sm">
              If that email has an account, we sent instructions to reset the password. The link works once and expires in 1 hour.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-text-muted text-sm">Enter the email of your account and we will send you a link to choose a new password.</p>
              <div>
                <label className="block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-gold transition-colors"
                  placeholder="ops@fleetguardian.com"
                  required
                />
              </div>
              {error && <p className="text-danger text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gold text-bg-deep font-semibold py-2.5 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-text-muted text-sm mt-5">
          <Link to="/login" className="text-gold hover:opacity-75 transition-opacity font-medium">Back to login</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Reset password page**

Create `frontend/src/pages/ResetPassword.jsx`:

```jsx
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth.api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password, confirmPassword)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message ?? err.response?.data?.error ?? 'Could not reset the password')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-gold transition-colors'
  const labelCls = 'block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5'

  return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-gold">Fleet Guardian</h1>
          <p className="text-text-muted text-sm mt-2">Choose a new password</p>
        </div>
        <div className="bg-surface border border-border-dim rounded-2xl p-8 space-y-5">
          {!token ? (
            <p className="text-danger text-sm">This link is not valid. Ask for a new one.</p>
          ) : done ? (
            <p className="text-text-muted text-sm">Your password was changed. You can log in with the new one now.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelCls}>New Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Min. 8 characters" required minLength={8} />
              </div>
              <div>
                <label className={labelCls}>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} placeholder="••••••••" required />
              </div>
              {error && <p className="text-danger text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gold text-bg-deep font-semibold py-2.5 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-text-muted text-sm mt-5">
          {done
            ? <Link to="/login" className="text-gold hover:opacity-75 transition-opacity font-medium">Go to login</Link>
            : <Link to="/forgot-password" className="text-gold hover:opacity-75 transition-opacity font-medium">Ask for a new link</Link>}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Link and routes**

In `frontend/src/pages/Login.jsx`, add a link under the password field, right before `{error && ...}`:

```jsx
          <div className="text-right -mt-2">
            <Link to="/forgot-password" className="text-text-muted hover:text-gold transition-colors text-xs">
              Forgot password?
            </Link>
          </div>
```

In `frontend/src/App.jsx`, add the imports after `import Register from './pages/Register'`:

```jsx
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
```

and the routes after the `/register` route:

```jsx
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
```

- [ ] **Step 5: Verify**

Run (in `frontend/`): `npx eslint src/pages/ForgotPassword.jsx src/pages/ResetPassword.jsx src/pages/Login.jsx src/App.jsx src/api/auth.api.js`
Expected: no output (clean).

Run (in `frontend/`): `npx vite build`
Expected: "built in ..." with no errors (the chunk size warning is pre-existing).

Run (in `frontend/`): `npm test`
Expected: all frontend tests pass.

- [ ] **Step 6: Commit**

```bash
git -c safe.directory='*' add frontend/src/api/auth.api.js frontend/src/pages/ForgotPassword.jsx frontend/src/pages/ResetPassword.jsx frontend/src/pages/Login.jsx frontend/src/App.jsx
git -c safe.directory='*' commit -q -F - <<'EOF'
Add forgot-password and reset-password pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Roll out and verify in production

**Files:**
- Temporary, never committed: `backend/_apply_sql.mjs`, `backend/_verify_forgot.mjs` (delete both when done)

**Interfaces:**
- Consumes: everything above. Needs the owner's admin credentials in the environment variables `TMS_EMAIL` and `TMS_PASSWORD` (never print them).

Production and development share one database. Steps 1 to 3 change production data and the deploy: get the owner's explicit OK for the migration and for the push before doing them.

- [ ] **Step 1: Apply the migration (with the owner's OK)**

Create `backend/_apply_sql.mjs`:

```js
import 'dotenv/config'
import pg from 'pg'
import { readFileSync } from 'node:fs'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
await client.query(readFileSync('migrations/manual/004_password_reset.sql', 'utf8'))
const col = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Usuario' AND column_name = 'passwordChangedAt'`)
const tbl = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_name = 'PasswordResetToken'`)
console.log('column:', col.rows.length === 1 ? 'ok' : 'MISSING', '| table:', tbl.rows.length === 1 ? 'ok' : 'MISSING')
await client.end()
```

Run (in `backend/`): `node _apply_sql.mjs` then `rm _apply_sql.mjs`
Expected: `column: ok | table: ok`. Running it twice must also work (idempotent).

- [ ] **Step 2: Run everything and push (with the owner's OK)**

Run (in `backend/`): `npm test` and (in `frontend/`) `npm test`
Expected: all pass.

Run: `git -c safe.directory='*' push origin master`

Wait for Railway. It is deployed when this stops returning 404:
`curl -s -o /dev/null -w "%{http_code}" -X POST https://fleetguardian-tms-production.up.railway.app/api/auth/forgot-password -H "Content-Type: application/json" -d '{"email":"nobody@example.com"}'`
Expected: `200`.

- [ ] **Step 3: Write and run the production verification**

Create `backend/_verify_forgot.mjs`. It runs the service locally against the shared database with a mailer that captures the link (the real provider only logs to Railway, which cannot be read from here), then uses the deployed API for the rest:

```js
import 'dotenv/config'
import prisma from './src/lib/prisma.js'
import { createPasswordResetService, createPrismaResetDb } from './src/services/passwordReset.service.js'

const API = 'https://fleetguardian-tms-production.up.railway.app'
const { TMS_EMAIL, TMS_PASSWORD } = process.env
const call = async (path, { method = 'GET', token, cookie, body } = {}) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await r.json() } catch {}
  return { status: r.status, json, headers: r.headers }
}
const check = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
const sleep = ms => new Promise(r => setTimeout(r, ms))

const admin = await call('/api/auth/login', { method: 'POST', body: { email: TMS_EMAIL, password: TMS_PASSWORD } })
check('admin login', admin.status === 200)
const token = admin.json.accessToken

const email = `prueba.olvido.${Date.now()}@example.com`
const inv = await call('/api/usuarios', { method: 'POST', token, body: { nombre: 'Prueba Olvido', email, rol: 'viewer' } })
const inviteeId = inv.json.id
try {
  const first = await call('/api/auth/login', { method: 'POST', body: { email, password: inv.json.tempPassword } })
  const oldCookie = first.headers.getSetCookie().find(c => c.startsWith('refreshToken=')).split(';')[0]
  check('invitee logs in and gets a refresh cookie', first.status === 200 && !!oldCookie)
  await sleep(2000) // the change must land in a later second than the cookie's iat

  const captured = []
  const service = createPasswordResetService({
    db: createPrismaResetDb(prisma),
    mailer: { sendMail: async m => { captured.push(m) } },
    frontendUrl: 'https://fleet-guardian-tms.vercel.app',
  })
  await service.requestReset(email)
  const resetToken = captured[0]?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1]
  check('the reset link was produced', !!resetToken && captured[0].text.includes('https://fleet-guardian-tms.vercel.app/reset-password?token='))

  const known = await call('/api/auth/forgot-password', { method: 'POST', body: { email } })
  const unknown = await call('/api/auth/forgot-password', { method: 'POST', body: { email: 'nadie.existe.olvido@example.com' } })
  check('forgot-password answers the same for known and unknown emails', known.status === 200 && unknown.status === 200 && JSON.stringify(known.json) === JSON.stringify(unknown.json))
  // The known call above replaced the token; ask the service again so we hold a live token.
  captured.length = 0
  await service.requestReset(email)
  const liveToken = captured[0].text.match(/token=([A-Za-z0-9_-]+)/)[1]

  const bad = await call('/api/auth/reset-password', { method: 'POST', body: { token: 'not-a-real-token', password: 'NewPass-12345', confirmPassword: 'NewPass-12345' } })
  check('unknown token is rejected (400)', bad.status === 400, bad.json?.error)
  const mismatch = await call('/api/auth/reset-password', { method: 'POST', body: { token: liveToken, password: 'NewPass-12345', confirmPassword: 'other' } })
  check('mismatched passwords are rejected (400)', mismatch.status === 400)
  const ok = await call('/api/auth/reset-password', { method: 'POST', body: { token: liveToken, password: 'NewPass-12345', confirmPassword: 'NewPass-12345' } })
  check('reset with a valid token works', ok.status === 200, `status ${ok.status}`)
  const reuse = await call('/api/auth/reset-password', { method: 'POST', body: { token: liveToken, password: 'Another-67890', confirmPassword: 'Another-67890' } })
  check('the same token cannot be reused (400)', reuse.status === 400)

  const oldPw = await call('/api/auth/login', { method: 'POST', body: { email, password: inv.json.tempPassword } })
  check('the old password stops working', oldPw.status === 401)
  const newPw = await call('/api/auth/login', { method: 'POST', body: { email, password: 'NewPass-12345' } })
  check('the new password works and no change is forced', newPw.status === 200 && newPw.json.user.mustChangePassword === false)

  const stale = await call('/api/auth/refresh', { method: 'POST', cookie: oldCookie })
  check('the session opened before the reset is rejected (401)', stale.status === 401, stale.json?.error)
  const newCookie = newPw.headers.getSetCookie().find(c => c.startsWith('refreshToken=')).split(';')[0]
  const fresh = await call('/api/auth/refresh', { method: 'POST', cookie: newCookie })
  check('the session opened after the reset works', fresh.status === 200)
} finally {
  const del = await call(`/api/usuarios/${inviteeId}`, { method: 'DELETE', token })
  check('test user deleted', del.status === 200)
  await prisma.$disconnect()
}
```

Run (in `backend/`), passing the credentials as environment variables and never echoing them: `TMS_EMAIL=... TMS_PASSWORD=... node _verify_forgot.mjs` then `rm _verify_forgot.mjs`
Expected: every line `PASS`. It makes 2 calls to forgot-password, well under the 5 per hour limit. If a line fails, stop and debug (superpowers:systematic-debugging) before continuing.

- [ ] **Step 4: Check the change-password path keeps the user logged in**

The admin `resetPassword` and `changePassword` changes have no automated test. Ask the owner to: invite a throwaway user from the Usuarios page, log in as that user, set the new password on the forced change screen, and confirm they land on the dashboard and stay logged in after 15+ minutes (or reload once after the access token expires). Then delete the throwaway user.

- [ ] **Step 5: Ask the owner to try the pages**

Ask the owner to open `https://fleet-guardian-tms.vercel.app/login`, click "Forgot password?", submit their own email, copy the link from the Railway deploy logs (search for `[mail:log]`), and set a new password. Remind them that with the `log` provider the link is visible in those logs.

- [ ] **Step 6: Record the outcome**

Update the project memory file `tms-day1-security-progress.md`: forgot-password shipped with the `log` provider, real email delivery still pending a domain, and mention that migration 004 is applied to production.

---

## Self-Review

**Spec coverage:** data and migration (Task 4, applied in Task 9); `resetToken` (Task 1); `mailer` with `log` and fail-at-boot (Task 2); service with request/confirm, single use, expiry, replacement, race (Task 5); endpoints, same 200 message, not awaited, limits 5/h and 10/h, schema rules (Task 6); refresh rejection by seconds, `changePassword` fresh cookie, admin reset sets `passwordChangedAt` (Tasks 3 and 7); frontend link, two pages, public routes (Task 8); all listed tests and the production check (Tasks 1 to 3, 5, 6, 9). Out-of-scope items are not planned.

**Placeholders:** none.

**Types:** `generateToken`, `hashToken`, `RESET_TOKEN_TTL_MS`, `getMailer`, `isRefreshRevoked`, `createPasswordResetService`, `createPrismaResetDb`, `createForgotPasswordLimiter`, `createResetPasswordLimiter`, `forgotPassword`, `confirmPasswordReset`, `authApi.forgotPassword`, `authApi.resetPassword` are defined once and used with the same names and signatures. The `db` method names (`findUserByEmail`, `replaceResetToken`, `findResetToken`, `consumeToken`) match between the fake in the tests and `createPrismaResetDb`.
