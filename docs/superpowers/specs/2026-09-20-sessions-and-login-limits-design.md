# Sessions with rotation and login limits: design (plan day 2)

Date: 2026-09-20
Status: design approved in chat, spec pending review

## Goal

Make sessions revocable and stolen refresh tokens detectable, and make login resistant to guessing and user enumeration. Covers day 2 of `docs/plan-mejoras-tms.html`.

## Decisions taken

- **Server-side sessions with rotation and reuse detection** (table `Sesion`), not a `tokenVersion` column. Rotating a stateless token does not protect anything: a stolen token stays valid for 7 days.
- **Login lockout is per email**: 5 failed attempts per 15 minutes and 15 per 24 hours, on top of the existing 10 per 15 minutes per IP. Known trade-off: an attacker can lock a victim's login for up to 15 minutes. Accepted because it also stops attacks spread over many IPs.
- Access tokens stay stateless and last 15 minutes, so a revoked session can still use its current access token for at most 15 minutes.
- This design replaces `passwordChangedAt` and `isRefreshRevoked` from the forgot-password design. That spec and plan get updated (see Docs to update).

## Data (manual migration `backend/migrations/manual/005_sessions.sql`)

Additive and idempotent. Applied to production BEFORE the backend code is pushed.

```sql
CREATE TABLE IF NOT EXISTS "Sesion" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "usuarioId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "rotatedAt" TIMESTAMP(3),
  "creadoEn"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");
-- FK to Usuario with ON DELETE CASCADE, guarded by a pg_constraint check as in 002_trailers.sql
```

`schema.prisma` gets the matching `Sesion` model and `Usuario.sesiones`.

## Session service (`backend/src/services/session.service.js`)

`createSessionService({ db, now, newId, ttlMs = 7 days, graceMs = 10 000 })`, database injected so it is unit-testable. The refresh JWT carries the session id as its `jti`.

- `start(usuarioId)` deletes that user's expired sessions, creates one and returns `{ sid, expiresAt }`.
- `rotate(sid)`:
  - session missing or expired: `{ ok: false, reason: 'invalid' }`;
  - never rotated: mark it rotated (atomic claim, only one caller wins), create a new session, return `{ ok: true, sid, usuarioId }`;
  - already rotated less than `graceMs` ago (two tabs, React StrictMode, a retry): create another new session without revoking anything, return `{ ok: true, ... }`;
  - already rotated more than `graceMs` ago: reuse detected, delete every session of that user, `{ ok: false, reason: 'reuse' }`.
- `end(sid)` deletes one session. `endAll(usuarioId)` deletes all of a user's sessions.

## Endpoints and controllers

- `login` and `register` call `start` and sign the refresh token with `jwtid = sid`.
- `refresh` verifies the JWT, then `rotate(payload.jti)`. A token without `jti` (issued before this deploy) is rejected with 401, so everyone logs in once again after deploying. On success it sets the new cookie and returns a new access token.
- `logout` ends the session named by the cookie (ignoring an invalid cookie) and clears it.
- New `POST /api/auth/logout-all` (requires login): `endAll` for the caller and clear the cookie. No UI button in this day.
- `changePassword`: `endAll`, then `start` and set a fresh cookie so the caller stays logged in.
- Admin `resetPassword` (`usuarios.controller.js`): `endAll` for the target user.

## Login without enumeration

When the email is unknown, compare the password against a constant dummy bcrypt hash so the response time matches the known-email path.

## Rate limits (`backend/src/lib/rateLimits.js`)

- Login per email: `createLoginEmailLimiters()` returns two limiters, 5 per 15 minutes and 15 per 24 hours, key = normalized email (falls back to the IP when the body has no email), failed attempts only (`skipSuccessfulRequests`). Mounted after the per-IP limiter. The sixth consecutive failure gets 429.
- Refresh: 60 per 15 minutes per IP.
- Document extraction (`/api/ratecon/extract`, `/api/registration/extract`): 10 per hour per user (key = `req.user.userId`), to protect the Gemini quota (20 per day on the free tier).
- Counters are in memory and reset on deploy.

## Tests

- `session.service` with a fake database: `start` cleans expired sessions; a fresh session rotates once; a second use within the grace window succeeds without revoking; a second use after the window revokes all sessions and fails; expired or unknown ids fail; two concurrent rotations do not both claim; `end` and `endAll`.
- Rate limits on a minimal Express app, like the existing ones: email key normalization, 5 then 429, the 24-hour tier, failures counted and successes not, per-user key.
- Production check by API script: login, refresh rotates the cookie, reusing the old cookie after the grace window returns 401 and revokes the new one, changing the password invalidates other sessions and keeps the caller's, six wrong passwords give 429 on the sixth, `logout-all` works.

## Deploy order and effects

1. Apply migration 005 to production (adds a table only, current code ignores it).
2. Push the backend. Every existing session ends: users log in once.
3. Verify with the API script.

## Docs to update

- `docs/superpowers/specs/2026-09-20-forgot-password-design.md` and `docs/superpowers/plans/2026-09-20-forgot-password.md`: drop `Usuario.passwordChangedAt`, `isRefreshRevoked` and their tasks; the reset confirmation calls `sessions.endAll` inside its flow instead.
- `docs/plan-mejoras-tms.html`: annotate day 2 with what is done.

## Out of scope

A sessions screen with device names, an "active sessions" list, a cron to purge old sessions, revoking access tokens before their 15 minutes end, real email delivery.

## Risks

- Missing migration in production breaks login (every login creates a session): apply it and verify the table before pushing.
- The grace window lets a stolen token that is used within 10 seconds of the legitimate rotation go unnoticed. Accepted.
- Per-email lockout can be used to annoy a specific user for 15 minutes.
- In-memory limits reset on deploy and are per instance.
