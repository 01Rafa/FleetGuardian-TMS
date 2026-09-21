# Tenant isolation and per-company trip codes: design (plan day 4)

Date: 2026-09-21
Status: design approved in chat, spec pending review

## Goal

A company can never reference, read, change or delete data of another company, and trip codes (`VLT-AAAA-NNN`) are per company, race-free and never reused. Covers day 4 of `docs/plan-mejoras-tms.html`.

## Findings that drive the design

1. `camionId`, `conductorPrincipalId`, `conductorSecundarioId` in create, update and merge of trips are used without checking the company (`vueltas.controller.js`).
2. `brokerId` in trip legs (`tramos`) on create trip, create leg and update leg is unchecked.
3. `tramoId` in expenses (`gastos`) on create trip, create expense and update expense is unchecked.
4. Read leak: `GET /api/vueltas/:id` returns the full truck, drivers and broker through `include`, so a cross-company reference exposes another company's records.
5. `codigo` is globally unique and computed as "last global code + 1": concurrent creates collide (an unfriendly 409) and two companies cannot both start at 001.
6. Latent bug: the last code is found with `orderBy codigo desc` (text order). At 1000 trips in a year `VLT-2026-999` sorts after `VLT-2026-1000`, so the next code collides.
7. `sugerencias.controller.js` loads trucks and drivers by `id` only.
8. `GET /api/admin/cache-stats` (any company admin) returns the most requested routes across all companies (`topRoutes`).

Everything else (trucks, drivers, trailers, maintenance, parts, notifications, dashboard, brokers) already filters by `empresaId`.

## Decisions taken

- **App-level guard, not database composite foreign keys.** Composite FKs are the strongest option but touch many production tables; kept as a later hardening. An auto-scoping Prisma extension was rejected as too invasive.
- **Foreign and nonexistent references answer the same 400** (`Invalid camionId`), so the response never says whether an id exists in another company.
- **Per-company atomic counter table**, unique `(empresaId, codigo)`, retry on collision. Numbers are never reused after a delete (better for invoices and audits).
- `topRoutes` is removed from `cache-stats`; only the aggregate counters remain.
- Existing codes are not rewritten.

## Reference guard (`backend/src/lib/tenancy.js`)

`assertOwnedReferences(db, empresaId, { camionId, conductorIds = [], brokerIds = [], tramoIds = [], vueltaId })` where `db` is a Prisma client or transaction:

- `camionId`: exists with `empresaId`.
- `conductorIds`: every id exists with `empresaId` (duplicates and `null` ignored).
- `brokerIds`: every id exists with `empresaId`.
- `tramoIds`: every id belongs to a trip of the company; when `vueltaId` is given, to that trip.
- On failure throws an error with `status = 400` and the message `Invalid <field>`; the field is the first offending one (`camionId`, `conductorPrincipalId`, `conductorSecundarioId`, `brokerId`, `tramoId`).

Applied in: create trip (camion, both drivers, every leg `brokerId`, every expense `tramoId` by company), update trip (the driver and truck fields present), merge trips (camion and both drivers), create and update leg (`brokerId`), create and update expense (`tramoId` must belong to that same trip).

## Trip codes (migration `backend/migrations/manual/007_tenant_trip_codes.sql`)

Additive, idempotent, applied to production BEFORE the backend code is pushed.

```sql
CREATE TABLE IF NOT EXISTS "ContadorVuelta" (
  "empresaId" TEXT NOT NULL,
  "anio"      INTEGER NOT NULL,
  "ultimo"    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("empresaId", "anio")
);
-- FK to Empresa ON DELETE CASCADE, guarded by a pg_constraint check

-- Start every counter at the current maximum so old codes are never reissued.
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

`schema.prisma`: model `ContadorVuelta` (composite id `empresaId, anio`), `Vuelta.codigo` loses `@unique` and gains `@@unique([empresaId, codigo])`.

**`backend/src/lib/tripCode.js`**:

- `formatCodigo(anio, n)` returns `VLT-${anio}-${String(n).padStart(3, '0')}` (three digits minimum, grows past 999 without breaking).
- `nextCodigo(tx, empresaId, anio)` runs one atomic statement inside the caller's transaction: `INSERT INTO "ContadorVuelta" ... VALUES (empresaId, anio, 1) ON CONFLICT (...) DO UPDATE SET "ultimo" = "ContadorVuelta"."ultimo" + 1 RETURNING "ultimo"`, then formats the code.
- `withTripCode(prisma, empresaId, buildAndCreate, { maxAttempts = 5 })` opens `prisma.$transaction`, gets the code, calls `buildAndCreate(tx, codigo)` and returns its result. On a Prisma `P2002` unique violation on `(empresaId, codigo)` it retries (which bumps the counter past any code created by the old backend), and throws after `maxAttempts`.

`createVuelta` and `mergeVueltas` use `withTripCode`. `buildNextCodigo` and `generarCodigo` are removed together with their old test.

## Smaller fixes

- `sugerencias.controller.js`: `camion.findFirst` and `conductor.findFirst` with `empresaId`.
- `admin.controller.js`: drop the `topRoutes` query and field.

## Testing

**Unit** (run in CI, no database): `assertOwnedReferences` with a fake database (each field, foreign and missing ids, duplicates and nulls, the same-trip rule); `formatCodigo` (padding and past 999); `withTripCode` with a fake transaction (returns the code, retries on `P2002` and gives up after 5, rethrows other errors).

**Integration** (`backend/test/integration/`, `npm run test:integration`, never in CI): needs `src/app.js` (the Express app without `listen`), split from `src/index.js` which keeps env validation, the marker guard, seed, cron and `listen`. The suite refuses to run unless the database marker is `development` (same check as the seed). It creates two companies with users, trucks, drivers, brokers, trips, legs and expenses directly with Prisma, mints access tokens with `signAccess`, serves the app on a random port and checks:

- Company A gets 400 on every endpoint that receives one of B's ids (create, update and merge trips, create and update legs, create and update expenses).
- Company A gets 404 reading, updating or deleting B's trips, legs and expenses, and sees none of B's records in any list.
- Two companies both get `VLT-<year>-001`; 20 simultaneous creates for one company give 20 distinct consecutive codes; a deleted trip's code is not reissued.
- A company admin's `cache-stats` has no `topRoutes`.
- Teardown deletes the test companies and everything under them.

## Rollout to production

The local `backend/.env` is development only, so production changes are run by the owner with two new scripts that take `--env production`, read the connection from the `DATABASE_URL` environment variable of the terminal session (never a file, never the chat) and refuse unless the database marker matches:

- `scripts/audit-tenancy.mjs`: read-only. Prints counts of trips whose truck or driver is from another company, legs whose broker is, and expenses whose leg is from another trip or company. Prints no ids or names.
- `scripts/apply-sql.mjs <file>`: applies a manual migration, then prints a confirmation query.

Order: 1) code, unit and integration tests, migration 007 applied and tested on the development database; 2) owner runs the audit on production (any non-zero count is decided together before continuing); 3) owner applies migration 007 on production; 4) push, CI green, production health; 5) API check with two throwaway companies registered through the public API, then the owner runs `scripts/cleanup-test-data.mjs --env production` (deletes companies whose users are `prueba.dia4.*@example.com` and only if they own nothing else).

## Out of scope

Composite foreign keys, role permissions (day 10), invoice numbering per company (day 15), running the integration suite in CI (possible later with a Postgres service container).

## Risks

- The old backend keeps creating global codes between migration and deploy: the retry loop and the counter backfill make the new code self-heal; the migration can be re-run after the deploy to realign counters (idempotent, `GREATEST`).
- Dropping the global unique index removes a safety net for the old code until the deploy; harmless for a single-instance backend that keeps generating `max + 1`.
- Existing production rows that already cross companies (if any) would make some trip pages show or fail on foreign data: the audit runs first and the owner decides.
- Tightening validation can make a client that sends a foreign id fail: the frontend only sends ids it received from the company's own lists, so normal use is unaffected.
