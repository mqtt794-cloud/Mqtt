-- =============================================================================
-- Database Migration Script - Secure OTA System
-- =============================================================================
-- Run this script inside the Supabase SQL Editor.
-- It ensures that the tables exist and contain the correct columns.

-- 1. Create firmware_releases table if not exists
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

-- 2. Create ota_jobs table if not exists
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

-- 3. Apply alters in case tables already existed
ALTER TABLE firmware_releases ADD COLUMN IF NOT EXISTS firmware_size BIGINT;
ALTER TABLE ota_jobs ADD COLUMN IF NOT EXISTS error_code TEXT;
