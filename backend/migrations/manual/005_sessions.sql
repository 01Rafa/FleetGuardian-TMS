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
