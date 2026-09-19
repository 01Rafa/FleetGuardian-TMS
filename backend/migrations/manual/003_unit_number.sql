-- Migration: 003_unit_number
-- Feature: optional unit number (numeroUnidad) on trucks and trailers
-- Additive and idempotent: safe to run more than once, changes no existing data.
-- Apply BEFORE deploying the backend that selects this column.

ALTER TABLE "Camion"  ADD COLUMN IF NOT EXISTS "numeroUnidad" TEXT;
ALTER TABLE "Trailer" ADD COLUMN IF NOT EXISTS "numeroUnidad" TEXT;
