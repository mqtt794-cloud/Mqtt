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

-- 4. Alter unique constraint on firmware_releases to be version per model
ALTER TABLE firmware_releases DROP CONSTRAINT IF EXISTS firmware_releases_version_key;
ALTER TABLE firmware_releases ADD CONSTRAINT unique_version_model UNIQUE (version, compatible_model);

-- 5. Add columns is_stable and minimum_firmware_version to firmware_releases
ALTER TABLE firmware_releases ADD COLUMN IF NOT EXISTS is_stable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE firmware_releases ADD COLUMN IF NOT EXISTS minimum_firmware_version TEXT;

-- 6. Add composite index and RPC function for device events retention cleanup
CREATE INDEX IF NOT EXISTS idx_device_events_device_created
ON device_events(device_id, created_at DESC);

CREATE OR REPLACE FUNCTION clean_old_device_events(target_device_id TEXT)
RETURNS VOID AS $$
BEGIN
  DELETE FROM device_events
  WHERE id IN (
      SELECT id
      FROM device_events
      WHERE device_id = target_device_id
      ORDER BY created_at DESC
      OFFSET 30
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Add composite index for OTA jobs retention cleanup
CREATE INDEX IF NOT EXISTS idx_ota_jobs_device_created
ON ota_jobs(device_id, created_at DESC);
