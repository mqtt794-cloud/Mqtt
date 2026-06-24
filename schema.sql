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
  switch_mode TEXT NOT NULL DEFAULT 'SMART' CHECK (switch_mode IN ('SMART', 'CLASSIC', 'DETACHED')),
  desired_switch_mode TEXT NOT NULL DEFAULT 'SMART' CHECK (desired_switch_mode IN ('SMART', 'CLASSIC', 'DETACHED')),
  config_status TEXT NOT NULL DEFAULT 'SYNCED' CHECK (config_status IN ('SYNCED', 'PENDING')),
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
VALUES ('ESP001', '301df2220b22a0753066d7ea8941097fa620e980f74577884df24a3e795c64b6', '2CH_RELAY', false)
ON CONFLICT (device_id) DO NOTHING;

-- 6. OAUTH CODES
CREATE TABLE IF NOT EXISTS oauth_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'admin',
  redirect_uri TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. OAUTH TOKENS
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'admin',
  access_token TEXT NOT NULL UNIQUE,
  refresh_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. FIRMWARE RELEASES
CREATE TABLE IF NOT EXISTS firmware_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  firmware_url TEXT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  firmware_size BIGINT NOT NULL,
  compatible_model VARCHAR(30) NOT NULL,
  release_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. OTA JOBS
CREATE TABLE IF NOT EXISTS ota_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  target_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'DOWNLOADING', 'INSTALLING', 'REBOOTING', 'SUCCESS', 'FAILED')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
