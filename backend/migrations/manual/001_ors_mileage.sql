-- Migration: 001_ors_mileage
-- Feature: ORS automatic mileage calculation
-- Apply against the production DB (via Supabase SQL editor or psql direct connection)
-- Safe to run more than once — all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

-- GeoCache: stores geocoded coordinates keyed by normalized address string
CREATE TABLE IF NOT EXISTS "GeoCache" (
  "id"                SERIAL PRIMARY KEY,
  "addressNormalized" TEXT    NOT NULL UNIQUE,
  "lat"               DOUBLE PRECISION NOT NULL,
  "lng"               DOUBLE PRECISION NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- RouteCache: stores ORS driving-hgv distances keyed by normalized origin+destination pair
CREATE TABLE IF NOT EXISTS "RouteCache" (
  "id"                SERIAL PRIMARY KEY,
  "origenNormalized"  TEXT             NOT NULL,
  "destinoNormalized" TEXT             NOT NULL,
  "distanceMillas"    DOUBLE PRECISION NOT NULL,
  "distanceKm"        DOUBLE PRECISION NOT NULL,
  "createdAt"         TIMESTAMP(3)     NOT NULL DEFAULT NOW(),
  "hitCount"          INTEGER          NOT NULL DEFAULT 0,
  UNIQUE ("origenNormalized", "destinoNormalized")
);

-- Tramo: add distance columns (null until ORS calculates them asynchronously)
ALTER TABLE "Tramo"
  ADD COLUMN IF NOT EXISTS "distanceMillas" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "distanceKm"     DOUBLE PRECISION;
