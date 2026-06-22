-- =============================================================================
-- SQL Schema Definition for Supabase PostgreSQL (Static Auth Compatible)
-- =============================================================================

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DEVICE REGISTRY
-- Factory registry containing device identifiers and their hashed secrets.
CREATE TABLE IF NOT EXISTS device_registry (
  device_id TEXT PRIMARY KEY,
  device_secret_hash TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '4CH_RELAY',
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. HOMES
-- Owned by the static administrator. We remove the foreign key references
-- constraint to auth.users to allow simple static single-user logins.
CREATE TABLE IF NOT EXISTS homes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'admin',
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. DEVICES
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE REFERENCES device_registry(device_id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  online BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen TIMESTAMPTZ,
  firmware_version TEXT,
  build_number INT,
  model TEXT DEFAULT '4CH_RELAY',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RELAYS
CREATE TABLE IF NOT EXISTS relays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  relay_number INT NOT NULL CHECK (relay_number BETWEEN 1 AND 4),
  relay_name TEXT NOT NULL,
  current_state BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_id, relay_number)
);

-- 5. DEVICE EVENTS
CREATE TABLE IF NOT EXISTS device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
--  SEEDING DEMO DEVICES (Optional)
--  Device ID: ESP001 | Secret: X7K29A
--  SHA-256 Hash of 'X7K29A' is: 301df2220b22a0753066d7ea8941097fa620e980f74577884df24a3e795c64b6
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO device_registry (device_id, device_secret_hash, model, claimed)
VALUES ('ESP001', '301df2220b22a0753066d7ea8941097fa620e980f74577884df24a3e795c64b6', '4CH_RELAY', false)
ON CONFLICT (device_id) DO NOTHING;
