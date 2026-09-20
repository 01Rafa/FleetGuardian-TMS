# Forgot password: design

Date: 2026-09-20
Status: approved in chat, spec pending review

## Goal

A user who forgot their password can set a new one from the login screen without help from an admin. Sessions opened with the old password stop working. The admin reset (`POST /api/usuarios/:id/reset-password`) benefits from the same session invalidation.

## Decisions taken

- **No email provider yet.** The owner has no domain, only the Vercel one, so Resend cannot be verified. Mail goes through a `sendMail` interface with a `log` provider (default) that writes the message to the server log. Gmail SMTP and Resend adapters come later by setting `MAIL_PROVIDER`, without touching the flow.
- **Interim consequence, stated on purpose:** with the `log` provider the reset link, which holds the secret token, appears in the Railway logs. The owner can copy it and send it by hand. Anyone with access to those logs could reset accounts. Replace the provider before real customers use the app.
- Session invalidation is checked at refresh time only. Access tokens live 15 minutes and `jwtAuth` does no database lookup, so an old access token can survive at most 15 minutes.

## Data (manual migration `backend/migrations/manual/004_password_reset.sql`)

Additive and idempotent, like the existing ones. Applied to production BEFORE pushing the backend code (Prisma selects every column, so a missing one breaks every query on `Usuario`).

```sql
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
-- FK to Usuario with ON DELETE CASCADE, guarded by a pg_constraint check as in 002_trailers.sql
```

`schema.prisma` gets the matching model and the `passwordChangedAt DateTime?` field.

## Backend

**`lib/resetToken.js`**: `generateToken()` returns `{ token, tokenHash }`. The token is 32 random bytes in base64url; the hash is its SHA-256 hex. Only the hash is stored.

**`lib/mailer.js`**: `sendMail({ to, subject, text })`. Provider chosen by `MAIL_PROVIDER` (default `log`). The `log` provider prints recipient, subject and text.

**`services/passwordReset.service.js`** (database and mailer injected, so it is testable with fakes):

- `requestReset(email)`: normalizes the email; if the user exists, deletes that user's unused tokens, stores a new hashed token expiring in 1 hour and sends the mail with `${FRONTEND_URL}/reset-password?token=<token>`. Returns nothing about whether the user exists.
- `confirmReset(token, password)`: finds the token by hash; it must exist, be unused and not expired, otherwise throws a 400 "Invalid or expired link". In one transaction it hashes the new password, updates `password`, sets `mustChangePassword = false` and `passwordChangedAt = now`, and sets `usedAt`.

**Endpoints** (`routes/auth.js`):

- `POST /api/auth/forgot-password { email }`: rate limited to 5 per hour per IP. Always answers 200 `{ message }` with the same text. `requestReset` runs without `await` (errors caught and logged) so response time does not reveal whether the email exists.
- `POST /api/auth/reset-password { token, password, confirmPassword }`: rate limited to 10 per hour per IP. Zod schema: password at least 8 characters, must equal `confirmPassword`.

**Sessions**:

- `refresh` selects `passwordChangedAt` and rejects the refresh token when `payload.iat < floor(passwordChangedAt / 1000)` (JWT `iat` is in whole seconds, so the comparison is in seconds to avoid rejecting a token issued in the same second as the change).
- `changePassword` and the admin `resetPassword` set `passwordChangedAt = now`. `changePassword` also issues a fresh refresh cookie so the user who just changed it is not logged out.

## Frontend

- Login: "Forgot password?" link.
- `/forgot-password`: email field; after submit always shows the same notice ("If that email has an account, we sent instructions").
- `/reset-password`: reads `token` from the query string, asks for the new password twice, on success sends the user to login. An invalid or expired link shows the server message and a link back to `/forgot-password`.
- Both routes are public.

## Tests

- `resetToken`: token is random, hash matches SHA-256, hash differs from token.
- `passwordReset.service` with fake db and mailer: unknown email sends no mail and does not throw; known email stores only the hash and sends one mail with the link; a second request removes the first token; expired, used and unknown tokens are rejected; a valid token changes the password, sets `passwordChangedAt`, marks the token used and cannot be reused.
- `refresh` rule as a small pure function (`isRefreshRevoked(iat, passwordChangedAt)`): revoked before the change, accepted after, same-second case accepted, no `passwordChangedAt` accepted.
- `mailer`: the `log` provider does not throw and unknown providers fail at boot.
- Production check by API script: request a reset for a throwaway user, take the link from the log, confirm, log in with the new password, confirm the old refresh cookie is rejected.

## Out of scope

Email verification at registration, real email delivery, per-email (not only per-IP) rate limits, revoking access tokens before their 15 minutes end.

## Risks

- Missing migration in production breaks all `Usuario` queries: apply it first and verify the column before pushing.
- The `log` provider leaks reset links to anyone who can read Railway logs (see Decisions).
- In-memory rate limits reset on deploy.
