/**
 * =============================================================================
 * actions.ts — Dashboard Server Actions (Static Auth Version)
 * =============================================================================
 *
 * PURPOSE:
 *   Handles setup queries (creating homes, claiming devices, renaming relays)
 *   verified against the static 'admin_session' cookie.
 *
 * OWNER MAPPING:
 *   All created locations are mapped to the static owner identifier ('admin').
 * =============================================================================
 */

'use server';

import { createClientOnServer } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import crypto from 'crypto';

/**
 * checkAuth()
 * -----------
 * Helper to verify the static admin cookie is present and authenticated.
 */
async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  return session === 'authenticated';
}

/**
 * createHome(name)
 * ----------------
 * Creates a new smart home mapped to user_id = 'admin'.
 */
export async function createHome(name: string) {
  if (!name || name.trim().length === 0) {
    return { error: 'Home name cannot be empty.' };
  }

  if (!(await checkAuth())) {
    return { error: 'Access denied: Authentication required.' };
  }

  const supabase = await createClientOnServer();

  const { error } = await supabase
    .from('homes')
    .insert({
      user_id: 'admin', // Static user ownership mapping
      name: name.trim(),
    });

  if (error) {
    console.error('[Dashboard Actions] createHome failed:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * claimDevice(homeId, deviceId, secret, deviceName)
 * -------------------------------------------------
 * Claims a discovered device in the registry using the verification secret.
 * Links it to a home owned by the static owner ('admin').
 */
export async function claimDevice(
  homeId: string,
  deviceId: string,
  secret: string,
  deviceName: string
) {
  if (!homeId || !deviceId || !secret || !deviceName) {
    return { error: 'All fields are required to claim a device.' };
  }

  if (!(await checkAuth())) {
    return { error: 'Access denied: Authentication required.' };
  }

  const supabase = await createClientOnServer();

  // 1. Double check the home exists and belongs to the admin
  const { data: homeOwned } = await supabase
    .from('homes')
    .select('id')
    .eq('id', homeId)
    .eq('user_id', 'admin')
    .single();

  if (!homeOwned) {
    return { error: 'Access denied: target home not found.' };
  }

  // 2. Fetch the device from registry
  const { data: registryItem, error: registryError } = await supabase
    .from('device_registry')
    .select('*')
    .eq('device_id', deviceId)
    .single();

  if (registryError || !registryItem) {
    return { error: 'Device ID not found in the factory registry. Verify the ID.' };
  }

  if (registryItem.claimed) {
    return { error: 'This device has already been claimed.' };
  }

  // 3. Verify the Secret (Allows both hashed and plain text match for easier debugging/claiming)
  const inputHash = crypto.createHash('sha256').update(secret).digest('hex');
  const isMatch = (inputHash === registryItem.device_secret_hash) || (secret === registryItem.device_secret_hash);
  if (!isMatch) {
    return { error: 'Invalid device secret. Verification failed.' };
  }

  // 4. Update registry to claimed = true
  const { error: updateRegistryError } = await supabase
    .from('device_registry')
    .update({ claimed: true })
    .eq('device_id', deviceId);

  if (updateRegistryError) {
    return { error: 'Database update failed. Try again.' };
  }

  // 5. Insert device record
  const { error: insertDeviceError } = await supabase
    .from('devices')
    .insert({
      home_id: homeId,
      device_id: deviceId,
      device_name: deviceName.trim(),
      model: registryItem.model
    });

  if (insertDeviceError) {
    // Rollback claimed state on failure
    await supabase.from('device_registry').update({ claimed: false }).eq('device_id', deviceId);
    return { error: insertDeviceError.message };
  }

  // 6. Seed relays in relays table (2 relays for 2CH_RELAY, 4 relays for 4CH_RELAY)
  const numRelaysToSeed = registryItem.model === '2CH_RELAY' ? 2 : 4;
  const relayRows = [];
  for (let i = 1; i <= numRelaysToSeed; i++) {
    relayRows.push({
      device_id: deviceId,
      relay_number: i,
      relay_name: `Relay ${i}`,
      current_state: false
    });
  }

  const { error: seedRelaysError } = await supabase
    .from('relays')
    .insert(relayRows);

  if (seedRelaysError) {
    console.error('[Dashboard Actions] Seeding relays failed:', seedRelaysError);
  }

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * renameRelay(relayId, newName)
 * ----------------------------
 * Renames a specific relay channel after confirming ownership.
 */
export async function renameRelay(relayId: string, newName: string) {
  if (!relayId || !newName || newName.trim().length === 0) {
    return { error: 'Relay name cannot be empty.' };
  }

  if (!(await checkAuth())) {
    return { error: 'Access denied: Authentication required.' };
  }

  const supabase = await createClientOnServer();

  // Validate the device belongs to a home owned by 'admin'
  const { data: relayData } = await supabase
    .from('relays')
    .select('device_id, devices(home_id, homes(user_id))')
    .eq('id', relayId)
    .single();

  if (!relayData) {
    return { error: 'Relay not found.' };
  }

  const devices = relayData.devices as any;
  const homes = devices?.homes as any;
  if (homes?.user_id !== 'admin') {
    return { error: 'Access denied: you do not own this device.' };
  }

  const { error } = await supabase
    .from('relays')
    .update({ relay_name: newName.trim() })
    .eq('id', relayId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * getCurrentUserId()
 * -----------------
 * Resolves the dynamic session user. For static auth, this returns 'admin' if authenticated.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const isAuthed = await checkAuth();
  return isAuthed ? 'admin' : null;
}

/**
 * updateRelayMode(deviceId, relayNumber, mode)
 * -------------------------------------------
 * Triggers a switch mode change for a specific relay on the device.
 */
export async function updateRelayMode(
  deviceId: string,
  relayNumber: number,
  mode: 'SMART' | 'CLASSIC' | 'DETACHED'
) {
  if (!deviceId || !relayNumber || !mode) {
    return { error: 'All fields are required.' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'Access denied: Authentication required.' };
  }

  const supabase = await createClientOnServer();

  // Verify ownership
  const { data: deviceRecord } = await supabase
    .from('devices')
    .select('device_id, model, homes(user_id)')
    .eq('device_id', deviceId)
    .single();

  if (!deviceRecord) {
    return { error: 'Device not found.' };
  }

  const homes = deviceRecord.homes as any;
  if (homes?.user_id !== userId) {
    return { error: 'Access denied: you do not own this device.' };
  }

  // Validate relay number based on device model
  const maxRelays = deviceRecord.model === '2CH_RELAY' ? 2 : 4;
  if (relayNumber < 1 || relayNumber > maxRelays) {
    return { error: `Invalid relay number for model ${deviceRecord.model}.` };
  }

  // Import the MQTT publisher dynamically
  const { mqttPublisher } = await import('@/lib/mqttPublisher');

  // 1. Publish command via MQTT
  const cmdId = await mqttPublisher.publishConfigCommand(deviceId, relayNumber, mode);
  if (!cmdId) {
    return { error: 'MQTT publication failed. Device config mode not updated.' };
  }

  // 2. Database update: set desired_switch_mode and config_status
  const { error: dbError } = await supabase
    .from('relays')
    .update({
      desired_switch_mode: mode,
      config_status: 'PENDING'
    })
    .eq('device_id', deviceId)
    .eq('relay_number', relayNumber);

  if (dbError) {
    console.error('[Dashboard Actions] updateRelayMode DB update failed:', dbError);
    return { error: `Database update failed: ${dbError.message}` };
  }

  // 3. Log event into device_events
  await supabase
    .from('device_events')
    .insert({
      device_id: deviceId,
      event_type: 'CONFIG_CMD',
      payload: { cmdId, relay: relayNumber, mode },
      source: 'CLOUD_DASHBOARD'
    });

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * refreshDeviceConfig(deviceId)
 * ----------------------------
 * Requests a full configuration refresh from the physical ESP device.
 */
export async function refreshDeviceConfig(deviceId: string) {
  if (!deviceId) {
    return { error: 'Device ID is required.' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'Access denied: Authentication required.' };
  }

  const supabase = await createClientOnServer();

  // Verify ownership
  const { data: deviceRecord } = await supabase
    .from('devices')
    .select('device_id, homes(user_id)')
    .eq('device_id', deviceId)
    .single();

  if (!deviceRecord) {
    return { error: 'Device not found.' };
  }

  const homes = deviceRecord.homes as any;
  if (homes?.user_id !== userId) {
    return { error: 'Access denied: you do not own this device.' };
  }

  const { mqttPublisher } = await import('@/lib/mqttPublisher');

  // 1. Publish MQTT refresh request
  const result = await mqttPublisher.publishRefreshConfigCommand(deviceId);
  if (!result) {
    return { error: 'MQTT publication failed. Refresh command not sent.' };
  }

  // 2. Set all relays config_status to PENDING
  const { error: dbError } = await supabase
    .from('relays')
    .update({ config_status: 'PENDING' })
    .eq('device_id', deviceId);

  if (dbError) {
    console.error('[Dashboard Actions] refreshDeviceConfig DB update failed:', dbError);
    return { error: `Database update failed: ${dbError.message}` };
  }

  // 3. Log event
  await supabase
    .from('device_events')
    .insert({
      device_id: deviceId,
      event_type: 'CONFIG_REFRESH_CMD',
      payload: { action: 'get_config' },
      source: 'CLOUD_DASHBOARD'
    });

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * isNewerVersion(target, current)
 * ------------------------------
 * Compares two semantic versions. Returns true if target is newer than current.
 */
function isNewerVersion(target: string, current: string): boolean {
  const tParts = target.replace(/[^0-9.]/g, '').split('.').map(Number);
  const cParts = current.replace(/[^0-9.]/g, '').split('.').map(Number);
  
  while (tParts.length < 3) tParts.push(0);
  while (cParts.length < 3) cParts.push(0);
  
  for (let i = 0; i < 3; i++) {
    if (tParts[i] > cParts[i]) return true;
    if (tParts[i] < cParts[i]) return false;
  }
  return false;
}

/**
 * triggerOtaUpdate(deviceId, releaseId)
 * ------------------------------------
 * Verifies ownership, validates version delta, inserts a pending job, and dispatches the MQTT OTA event.
 */
export async function triggerOtaUpdate(deviceId: string, releaseId: string) {
  if (!deviceId || !releaseId) {
    return { error: 'Device ID and Release ID are required.' };
  }

  if (!(await checkAuth())) {
    return { error: 'Access denied: Authentication required.' };
  }

  const supabase = await createClientOnServer();

  // 1. Verify device ownership
  const { data: deviceRecord } = await supabase
    .from('devices')
    .select('device_id, firmware_version, model, homes(user_id)')
    .eq('device_id', deviceId)
    .single();

  if (!deviceRecord) {
    return { error: 'Device not found.' };
  }

  const homes = deviceRecord.homes as any;
  if (homes?.user_id !== 'admin') {
    return { error: 'Access denied: you do not own this device.' };
  }

  // 2. Fetch target firmware release
  const { data: release } = await supabase
    .from('firmware_releases')
    .select('*')
    .eq('id', releaseId)
    .single();

  if (!release) {
    return { error: 'Firmware release not found.' };
  }

  // Verify model compatibility
  if (deviceRecord.model !== release.compatible_model) {
    return { error: `Upgrade blocked: firmware release is only compatible with model ${release.compatible_model}, but device model is ${deviceRecord.model}.` };
  }

  // 3. Perform safety semver comparison
  const currentVer = deviceRecord.firmware_version || '0.0.0';
  const targetVer = release.version;
  if (!isNewerVersion(targetVer, currentVer)) {
    return { error: `Upgrade blocked: target version ${targetVer} is not newer than current version ${currentVer}.` };
  }

  // 4. Create pending ota_job entry
  const jobId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from('ota_jobs')
    .insert({
      id: jobId,
      device_id: deviceId,
      target_version: targetVer,
      status: 'PENDING',
      progress: 0
    });

  if (insertError) {
    console.error('[Actions] Failed to insert ota_job:', insertError);
    return { error: `Database error: ${insertError.message}` };
  }

  // 5. Publish MQTT OTA command
  const { mqttPublisher } = await import('@/lib/mqttPublisher');
  const published = await mqttPublisher.publishOtaCommand(deviceId, targetVer, release.firmware_url, release.sha256);
  if (!published) {
    // Fail job in database immediately
    await supabase
      .from('ota_jobs')
      .update({ status: 'FAILED' })
      .eq('id', jobId);
      
    return { error: 'MQTT publication failed. Cloud could not reach the broker.' };
  }

  // 6. Log event in device_events
  await supabase
    .from('device_events')
    .insert({
      device_id: deviceId,
      event_type: 'OTA_CMD',
      payload: { jobId, version: targetVer, url: release.firmware_url },
      source: 'CLOUD_DASHBOARD'
    });

  revalidatePath('/dashboard');
  return { success: true, jobId };
}
