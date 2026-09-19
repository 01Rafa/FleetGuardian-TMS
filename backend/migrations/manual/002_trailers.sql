-- Migration: 002_trailers
-- Feature: Trailers (own entity, own maintenance and parts)
-- Additive and idempotent: safe to run more than once, deletes no data.

CREATE TABLE IF NOT EXISTS "Trailer" (
  "id"                      TEXT NOT NULL PRIMARY KEY,
  "empresaId"               TEXT NOT NULL,
  "placa"                   TEXT NOT NULL,
  "tipo"                    TEXT NOT NULL,
  "modelo"                  TEXT NOT NULL,
  "anio"                    INTEGER,
  "capacidadTon"            DOUBLE PRECISION,
  "estado"                  TEXT NOT NULL DEFAULT 'disponible',
  "vin"                     TEXT,
  "color"                   TEXT,
  "fechaCompra"             TIMESTAMP(3),
  "notas"                   TEXT,
  "dotInspectionLastDate"   TIMESTAMP(3),
  "stateInspectionLastDate" TIMESTAMP(3),
  "brakeInspectionLastDate" TIMESTAMP(3),
  "registrationExpiry"      TIMESTAMP(3),
  "cargoInsuranceExpiry"    TIMESTAMP(3),
  "epaRefrigerantExpiry"    TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "Trailer_empresaId_idx" ON "Trailer"("empresaId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trailer_empresaId_fkey') THEN
    ALTER TABLE "Trailer" ADD CONSTRAINT "Trailer_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Mantenimiento: optional owner
ALTER TABLE "Mantenimiento" ALTER COLUMN "camionId" DROP NOT NULL;
ALTER TABLE "Mantenimiento" ADD COLUMN IF NOT EXISTS "trailerId" TEXT;
CREATE INDEX IF NOT EXISTS "Mantenimiento_trailerId_idx" ON "Mantenimiento"("trailerId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mantenimiento_trailerId_fkey') THEN
    ALTER TABLE "Mantenimiento" ADD CONSTRAINT "Mantenimiento_trailerId_fkey"
      FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mantenimiento_one_owner') THEN
    ALTER TABLE "Mantenimiento" ADD CONSTRAINT "Mantenimiento_one_owner"
      CHECK (num_nonnulls("camionId", "trailerId") = 1);
  END IF;
END $$;

-- Pieza: optional owner
ALTER TABLE "Pieza" ALTER COLUMN "camionId" DROP NOT NULL;
ALTER TABLE "Pieza" ADD COLUMN IF NOT EXISTS "trailerId" TEXT;
CREATE INDEX IF NOT EXISTS "Pieza_trailerId_idx" ON "Pieza"("trailerId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pieza_trailerId_fkey') THEN
    ALTER TABLE "Pieza" ADD CONSTRAINT "Pieza_trailerId_fkey"
      FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pieza_one_owner') THEN
    ALTER TABLE "Pieza" ADD CONSTRAINT "Pieza_one_owner"
      CHECK (num_nonnulls("camionId", "trailerId") = 1);
  END IF;
END $$;
