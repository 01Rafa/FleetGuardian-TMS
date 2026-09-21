-- Migration: 006_environment_marker
-- Feature: every database records which environment it is (production, staging, development).
-- Additive and idempotent. Creates the table only, it never inserts a row:
-- the row is written on purpose with `node scripts/mark-environment.mjs <name>`.

CREATE TABLE IF NOT EXISTS "AppEnvironment" (
  "id"   INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "name" TEXT NOT NULL,
  CONSTRAINT "AppEnvironment_single_row" CHECK ("id" = 1)
);
