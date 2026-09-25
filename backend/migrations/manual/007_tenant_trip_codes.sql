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
