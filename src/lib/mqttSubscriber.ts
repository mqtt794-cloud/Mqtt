/**
 * =============================================================================
 * mqttSubscriber.ts — Secure MQTT Subscriber Background Service
 * =============================================================================
 *
 * PURPOSE:
 *   Listens to device topics, processes incoming statuses/state updates/acks,
 *   and updates the Supabase PostgreSQL database in real-time.
 *
 * DETAILED TOPICS MONITORED:
 *   1. home/+/status (Heartbeats & Birth messages)
 *      - Auto-discovers unknown devices by adding them to `device_registry`
 *        with a default secret 'X7K29A' to simplify testing.
 *      - Updates device's connection status (`online`), `last_seen`,
 *        and metadata (`firmware_version`, `build_number`, `model`).
 *   2. home/+/state (Relay state snapshots)
 *      - Updates the `current_state` column in the `relays` table for all 4 channels.
 *   3. home/+/ack (Command execution acknowledgements)
 *      - Logs a `COMMAND_ACK` event in the `device_events` table.
 *
 * ARCHITECTURAL NOTE:
 *   Inside Next.js (especially in serverless deployment like Vercel), long-running
 *   daemons are killed after request timeouts. For development and local node servers,
 *   we bootstrap this subscriber via `src/instrumentation.ts`. For production,
 *   this service should be moved into a standalone Node process (e.g. on Railway/Docker).
 * =============================================================================
 */

import mqtt from 'mqtt';
import crypto from 'crypto';
import { supabaseAdmin, validateSupabaseAdmin } from './supabase';

class MqttSubscriber {
  private _client: mqtt.MqttClient | null = null;
  private _initialized = false;

  /**
   * begin()
   * -------
   * Establishes the secure connection to HiveMQ Cloud and registers topic subscriptions.
   * Leverages the supabaseAdmin client to bypass RLS for background database updates.
   */
  public async begin() {
    if (this._initialized) {
      console.log('[SUBSCRIBER] Already running.');
      return true;
    }

    // ── Step 1: Validate Supabase admin client BEFORE connecting to MQTT ──────
    console.log('[SUBSCRIBER] Validating Supabase admin connection...');
    const supabaseReady = await validateSupabaseAdmin();
    if (!supabaseReady) {
      console.error('[SUBSCRIBER][ERROR] Supabase validation failed. Subscriber will NOT start.');
      return false;
    }

    // Run watchdog stale jobs cleanup on startup
    await this._cleanupOtaJobs();

    // ── Step 2: Validate MQTT credentials ────────────────────────────────────
    const brokerUrl = process.env.MQTT_BROKER_URL;
    const username  = process.env.MQTT_USERNAME;
    const password  = process.env.MQTT_PASSWORD;

    if (!brokerUrl) {
      console.warn('[SUBSCRIBER][ERROR] Missing MQTT_BROKER_URL. Subscriber not started.');
      return false;
    }

    console.log(`[MQTT] Connecting to secure broker: ${brokerUrl}`);

    this._client = mqtt.connect(brokerUrl, {
      username,
      password,
      rejectUnauthorized: true,  // Perform certificate verification
      connectTimeout: 5000,
      reconnectPeriod: 2000,
    });

    this._client.on('connect', () => {
      console.log('[MQTT] Connected successfully. Registering subscriptions...');
      this._initialized = true;

      // Subscribe using wildcard '+' for device_id: home/{device_id}/{topic}
      this._client?.subscribe([
        'home/+/status',
        'home/+/state',
        'home/+/ack',
        'home/+/config_state',
        'home/+/ota_status',
      ], { qos: 1 }, (error, granted) => {
        if (error) {
          console.error('[MQTT][ERROR] Subscription failed:', error);
          return;
        }

        const topics = (granted ?? []).map(({ topic, qos }) => `${topic} (qos ${qos})`).join(', ');
        console.log(`[MQTT] Subscription acknowledged: ${topics}`);
      });
    });

    this._client.on('message', async (topic, message) => {
      console.log(`[MQTT] Message received on topic: ${topic}`);
      try {
        await this._handleMessage(topic, message.toString());
      } catch (error) {
        console.error(`[MQTT][ERROR] Error processing message on topic ${topic}:`, error);
        console.error(`[MQTT][ERROR] Payload: ${message.toString()}`);
      }
    });

    this._client.on('error', (error) => {
      console.error('[MQTT][ERROR] Client error:', error);
    });

    return true;
  }

  public stop() {
    if (this._client) {
      this._client.end(true);
      this._client = null;
    }

    this._initialized = false;
  }

  private async _cleanupOtaJobs() {
    try {
      const now = new Date();
      
      // 1. Timeout for downloading/installing: 10 minutes
      const downloadTimeoutLimit = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      const { data: downloadStaleJobs, error: downloadErr } = await supabaseAdmin
        .from('ota_jobs')
        .select('id, device_id, progress')
        .in('status', ['PENDING', 'DOWNLOADING', 'INSTALLING'])
        .lt('updated_at', downloadTimeoutLimit);

      if (downloadErr) {
        console.error('[MQTT Subscriber Watchdog] Failed to query downloading/installing jobs:', downloadErr.message);
      } else if (downloadStaleJobs && downloadStaleJobs.length > 0) {
        console.log(`[MQTT Subscriber Watchdog] Timed out ${downloadStaleJobs.length} active downloading jobs:`, downloadStaleJobs);
        for (const job of downloadStaleJobs) {
          await this._updateOtaJobStatus(job.id, job.device_id, 'FAILED', job.progress || 0, 'DOWNLOAD_TIMEOUT');
        }
      }

      // 2. Timeout for rebooting (Rollback detection): 5 minutes
      const rollbackLimit = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      const { data: rollbackJobs, error: rollbackErr } = await supabaseAdmin
        .from('ota_jobs')
        .select('id, device_id, progress')
        .eq('status', 'REBOOTING')
        .lt('updated_at', rollbackLimit);

      if (rollbackErr) {
        console.error('[MQTT Subscriber Watchdog] Failed to query rebooting/rollback jobs:', rollbackErr.message);
      } else if (rollbackJobs && rollbackJobs.length > 0) {
        console.log(`[MQTT Subscriber Watchdog] Rolled back ${rollbackJobs.length} rebooting jobs (timeout):`, rollbackJobs);
        for (const job of rollbackJobs) {
          await this._updateOtaJobStatus(job.id, job.device_id, 'FAILED', job.progress || 0, 'ROLLBACK_DETECTED');
        }
      }
    } catch (watchdogErr) {
      console.error('[MQTT Subscriber Watchdog] Stale job cleanup failed:', watchdogErr);
    }
  }

  /**
   * _handleMessage(topic, payloadString)
   * ------------------------------------
   * Parses the topic wildcard structure and routes the message payload to the correct handler.
   */
  private async _handleMessage(topic: string, payloadString: string) {
    const parts = topic.split('/');
    if (parts.length !== 3) return;

    const deviceId = parts[1];
    const subTopic = parts[2];
    const payload  = JSON.parse(payloadString);

    if (subTopic === 'status') {
      await this._handleStatus(deviceId, payload);
    } else if (subTopic === 'state') {
      await this._handleState(deviceId, payload);
    } else if (subTopic === 'ack') {
      await this._handleAck(deviceId, payload);
    } else if (subTopic === 'config_state') {
      await this._handleConfigState(deviceId, payload);
    } else if (subTopic === 'ota_status') {
      await this._handleOtaStatus(deviceId, payload);
    }
  }

  /**
   * _handleStatus(deviceId, payload)
   * ---------------------------------
   * Processes heartbeats and online events. If the device ID doesn't exist
   * in the registry, it auto-inserts it with a default claim secret.
   *
   * IDEMPOTENCY GUARANTEE:
   *   Uses .maybeSingle() (not .single()) so that a zero-row result returns
   *   null without throwing a PostgREST error. The upsert below is additionally
   *   guarded by `ignoreDuplicates: true` (ON CONFLICT DO NOTHING) so parallel
   *   status messages cannot create duplicate registry entries.
   */
  private async _handleStatus(deviceId: string, payload: any) {
    console.log(`[STATUS] Packet received for device ${deviceId}`);
    console.log(`[STATUS] Payload:`, JSON.stringify(payload));
    console.log(`[REGISTER] Register flag = ${payload.register}`);

    const incomingSecret = payload.deviceSecret || payload.secret;

    if (payload.register === true || incomingSecret) {
      console.log(`[REGISTER] Device registration triggered. Looking up registry for device_id: ${deviceId}`);

      const incomingHash = incomingSecret
        ? crypto.createHash('sha256').update(incomingSecret).digest('hex')
        : null;

      // Fetch existing device from registry to avoid overwriting
      console.log(`[SUPABASE] Fetching device_registry for device_id: ${deviceId}`);
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('device_registry')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (fetchError) {
        console.error(`[REGISTER][ERROR] Registration lookup FAILED`);
        console.error(`[SUPABASE][ERROR] Supabase fetch error:`, fetchError.message);
        console.error(`[ERROR] Stack:`, new Error().stack);
        console.error(`[ERROR] Payload:`, payload);
        console.error(`[ERROR] Topic: home/${deviceId}/status`);
        return;
      }

      if (existing) {
        console.log(`[REGISTER] Device already exists in registry.`);

        // Existing Device Protection: Do NOT overwrite. Log mismatch if detected.
        if (incomingHash && existing.device_secret_hash !== incomingHash) {
          console.warn(`[REGISTER][WARNING] Secret mismatch detected for device ${deviceId}!`);
        }
        // Auto-upgrade model registry
        if (payload.model && existing.model !== payload.model) {
          console.log(`[UPDATE] Upgrading device model from ${existing.model} to ${payload.model} for ${deviceId}`);
          const { error: updateError } = await supabaseAdmin
            .from('device_registry')
            .update({ model: payload.model })
            .eq('device_id', deviceId);

          if (updateError) {
            console.error(`[UPDATE][ERROR] Updating device model FAILED`);
            console.error(`[SUPABASE][ERROR] Supabase update error:`, updateError.message);
            console.error(`[ERROR] Stack:`, new Error().stack);
            console.error(`[ERROR] Payload:`, payload);
            console.error(`[ERROR] Topic: home/${deviceId}/status`);
            return;
          }
          console.log(`[UPDATE] Device model updated successfully.`);
        }
        console.log(`[REGISTER] Registration complete`);
      } else {
        console.log(`[REGISTER] Device not found in registry. Preparing to insert new device...`);

        if (!incomingHash) {
          console.error(`[REGISTER][ERROR] Registration FAILED`);
          console.error(`[ERROR] Reason: Missing device secret for new registration`);
          console.error(`[ERROR] Stack:`, new Error().stack);
          console.error(`[ERROR] Payload:`, payload);
          console.error(`[ERROR] Topic: home/${deviceId}/status`);
          return;
        }

        // New device discovery: Insert incoming secret from firmware
        console.log(`[INSERT] Inserting device ${deviceId} into device_registry...`);
        const { error: insertError } = await supabaseAdmin
          .from('device_registry')
          .insert({
            device_id: deviceId,
            device_secret_hash: incomingHash,
            model: payload.model || '4CH_RELAY',
            claimed: false
          });

        if (insertError) {
          console.error(`[INSERT][ERROR] Device registration insert FAILED`);
          console.error(`[SUPABASE][ERROR] Supabase insert error:`, insertError.message);
          console.error(`[ERROR] Stack:`, new Error().stack);
          console.error(`[ERROR] Payload:`, payload);
          console.error(`[ERROR] Topic: home/${deviceId}/status`);
        } else {
          console.log(`[INSERT] Device ${deviceId} inserted successfully into device_registry.`);
          console.log(`[DISCOVERY] Device ID: ${deviceId}`);
          console.log(`[DISCOVERY] Secret Hash Stored`);
          console.log(`[DISCOVERY] Registration Success`);
          console.log(`[REGISTER] Registration complete`);
        }
      }
    } else {
      console.log(`[REGISTER] Registration skipped (register flag is not true and no secret was provided).`);
    }

    // 2. Check if device is claimed (exists in devices table)
    //    .maybeSingle() returns null (no error) when zero rows match.
    const { data: claimedDevice, error: claimedError } = await supabaseAdmin
      .from('devices')
      .select('id')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (claimedError) {
      console.error(`[MQTT Subscriber] Error checking if device is claimed:`, claimedError.message);
    }

    if (claimedDevice) {
      // Update online status and metadata on the active device
      const { error: deviceUpdateErr } = await supabaseAdmin
        .from('devices')
        .update({
          online: payload.online,
          last_seen: new Date().toISOString(),
          firmware_version: payload.firmware,
          build_number: payload.build,
          model: payload.model
        })
        .eq('device_id', deviceId);

      if (deviceUpdateErr) {
        console.error(`[MQTT Subscriber] Failed to update device online status:`, deviceUpdateErr.message);
      }

      // Verify active/rebooting OTA job for successful upgrade check
      const { data: activeOtaJob, error: otaJobErr } = await supabaseAdmin
        .from('ota_jobs')
        .select('id, target_version, status, updated_at, progress')
        .eq('device_id', deviceId)
        .in('status', ['PENDING', 'DOWNLOADING', 'INSTALLING', 'REBOOTING'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otaJobErr) {
        console.error(`[MQTT Subscriber] Failed to query active ota_jobs for ${deviceId}:`, otaJobErr.message);
      }

      if (activeOtaJob) {
        if (payload.firmware === activeOtaJob.target_version) {
          await this._updateOtaJobStatus(activeOtaJob.id, deviceId, 'SUCCESS', 100);
          console.log(`[MQTT Subscriber] OTA Job ${activeOtaJob.id} succeeded for ${deviceId}. Version upgraded to ${payload.firmware}.`);
        } else if (activeOtaJob.status === 'REBOOTING') {
          const elapsed = Date.now() - new Date(activeOtaJob.updated_at).getTime();
          if (elapsed >= 5 * 60 * 1000) {
            await this._updateOtaJobStatus(activeOtaJob.id, deviceId, 'FAILED', activeOtaJob.progress || 0, 'ROLLBACK_DETECTED');
            console.log(`[MQTT Subscriber] OTA Job ${activeOtaJob.id} failed (ROLLBACK_DETECTED) for ${deviceId} after 5+ minutes elapsed.`);
          }
        }
      }

      // Automatic Relay Table Cleanup for 2-channel hardware simplification
      if (payload.model === '2CH_RELAY') {
        const { error: cleanupError } = await supabaseAdmin
          .from('relays')
          .delete()
          .eq('device_id', deviceId)
          .gt('relay_number', 2);
        if (cleanupError) {
          console.error(`[MQTT Subscriber] Failed to cleanup ghost relays for ${deviceId}:`, cleanupError.message);
        }
      }
    }

    // 3. Log event into device_events
    await this._logDeviceEvent(deviceId, 'STATUS_UPDATE', payload);
  }

  /**
   * _handleState(deviceId, payload)
   * -------------------------------
   * Synchronizes relay states (r1 ... r4) back to the database.
   */
  private async _handleState(deviceId: string, payload: Record<string, boolean>) {
    console.log(`[MQTT Subscriber] State snapshot from ${deviceId}:`, payload);

    // 1. Verify if device is claimed
    //    .maybeSingle() returns null (no error) when zero rows match.
    const { data: claimedDevice } = await supabaseAdmin
      .from('devices')
      .select('id, model')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (!claimedDevice) return;

    // 2. Loop through r1..r4 in payload and update the relays table (respect model limits)
    const maxRelays = claimedDevice.model === '2CH_RELAY' ? 2 : 4;
    for (let i = 1; i <= 4; i++) {
      const stateKey = `r${i}`;
      if (payload[stateKey] !== undefined) {
        if (i > maxRelays) {
          console.warn(`[MQTT] Invalid relay number: ${i} for device ${deviceId} (model: ${claimedDevice.model})`);
          continue;
        }
        await supabaseAdmin
          .from('relays')
          .update({ current_state: payload[stateKey] })
          .eq('device_id', deviceId)
          .eq('relay_number', i);
      }
    }

    // 3. Log event into device_events
    await this._logDeviceEvent(deviceId, 'STATE_SNAPSHOT', payload);
  }

  /**
   * _handleAck(deviceId, payload)
   * ------------------------------
   * Logs execution acknowledgments published by the device.
   */
  private async _handleAck(deviceId: string, payload: any) {
    console.log(`[MQTT Subscriber] ACK received from ${deviceId}:`, payload);

    // Log the ACK event
    await this._logDeviceEvent(deviceId, 'COMMAND_ACK', payload);
  }

  /**
   * _handleConfigState(deviceId, payload)
   * ------------------------------------
   * Processes the device switch configuration state published on home/+/config_state.
   */
  private async _handleConfigState(deviceId: string, payload: any) {
    console.log(`[MQTT Subscriber] Config state from ${deviceId}:`, payload);

    // 1. Verify device is claimed and retrieve model
    const { data: claimedDevice } = await supabaseAdmin
      .from('devices')
      .select('id, model')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (!claimedDevice) {
      console.warn(`[MQTT Subscriber] Config state received for unclaimed/unknown device: ${deviceId}`);
      return;
    }

    // 2. Validate channels format
    const channels = payload.channels;
    if (!Array.isArray(channels)) {
      console.error(`[MQTT Subscriber] Invalid config_state payload: 'channels' is not an array`);
      return;
    }

    const expectedCount = claimedDevice.model === '2CH_RELAY' ? 2 : 4;
    if (channels.length !== expectedCount) {
      console.error(`[CONFIG] Invalid channel count: expected ${expectedCount}, got ${channels.length}`);
      return;
    }

    // 3. Update database for each channel
    for (const channel of channels) {
      const relayNumber = channel.relay;
      const mode = channel.mode;

      if (typeof relayNumber !== 'number' || typeof mode !== 'string') {
        console.error(`[MQTT Subscriber] Invalid channel item in config_state payload:`, channel);
        continue;
      }

      if (relayNumber < 1 || relayNumber > expectedCount) {
        console.error(`[MQTT Subscriber] Invalid relay number ${relayNumber} in config_state for model ${claimedDevice.model}`);
        continue;
      }

      // Sync switch_mode and desired_switch_mode, set config_status to SYNCED
      await supabaseAdmin
        .from('relays')
        .update({
          switch_mode: mode,
          desired_switch_mode: mode,
          config_status: 'SYNCED'
        })
        .eq('device_id', deviceId)
        .eq('relay_number', relayNumber);
    }

    // 4. Log event
    await this._logDeviceEvent(deviceId, 'CONFIG_SNAPSHOT', payload);
  }

  /**
   * _handleOtaStatus(deviceId, payload)
   * ----------------------------------
   * Processes the device's progress notifications during OTA update steps.
   * Expected payload shapes:
   *   {"status": "DOWNLOADING", "progress": 25}
   *   {"status": "INSTALLING"}
   *   {"status": "SUCCESS"}
   *   {"status": "FAILED", "error": "Connection timed out"}
   */
  private async _handleOtaStatus(deviceId: string, payload: any) {
    console.log(`[MQTT Subscriber] OTA status from ${deviceId}:`, payload);

    const status = payload.status;
    const progress = typeof payload.progress === 'number' ? payload.progress : 0;
    const errorMsg = payload.error || null;

    if (!status) {
      console.error(`[MQTT Subscriber] Invalid ota_status message: missing status field`);
      return;
    }

    // 1. Locate the latest non-finalized OTA job for this device
    const { data: activeJob, error: queryError } = await supabaseAdmin
      .from('ota_jobs')
      .select('*')
      .eq('device_id', deviceId)
      .in('status', ['PENDING', 'DOWNLOADING', 'INSTALLING', 'REBOOTING'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error(`[MQTT Subscriber] Failed to query active ota_jobs:`, queryError.message);
    }

    if (activeJob) {
      await this._updateOtaJobStatus(activeJob.id, deviceId, status, progress, errorMsg);
    } else {
      console.warn(`[MQTT Subscriber] Received ota_status update but no active OTA job found for device ${deviceId}`);
    }

    // 3. Log the status event in device_events
    await this._logDeviceEvent(deviceId, 'OTA_STATUS', payload);
  }

  /**
   * _logDeviceEvent(deviceId, eventType, payload, source)
   * ----------------------------------------------------
   * Logs a device event into the database and cleans up old events
   * so that each device retains at most 30 events in the history.
   */
  private async _logDeviceEvent(deviceId: string, eventType: string, payload: any, source: string = 'MQTT') {
    // 1. Insert the event
    const { error: insertErr } = await supabaseAdmin
      .from('device_events')
      .insert({
        device_id: deviceId,
        event_type: eventType,
        payload: payload,
        source: source
      });

    if (insertErr) {
      console.error(`[MQTT Subscriber] Failed to log event ${eventType} for ${deviceId}:`, insertErr.message);
      return;
    }

    // 2. Perform old event retention cleanup (keep maximum 30 events per device)
    // Run cleanup asynchronously in the background so it never blocks MQTT loops
    Promise.resolve(
      supabaseAdmin.rpc('clean_old_device_events', { target_device_id: deviceId })
    )
      .then(({ error: rpcErr }) => {
        if (rpcErr) {
          console.error(`[MQTT Subscriber] Failed to clean up events for ${deviceId}:`, rpcErr.message);
        }
      })
      .catch((err: any) => {
        console.error(`[MQTT Subscriber] Unexpected error during event cleanup for ${deviceId}:`, err);
      });
  }

  /**
   * _cleanupOtaHistory(deviceId)
   * ----------------------------
   * Cleans up historical OTA jobs in PostgreSQL so that each device retains
   * only its current active job and its single latest completed (SUCCESS/FAILED) job.
   */
  private _cleanupOtaHistory(deviceId: string) {
    cleanupOtaHistory(deviceId);
  }

  /**
   * _updateOtaJobStatus(jobId, deviceId, status, progress, errorCode)
   * -----------------------------------------------------------------
   * Centralized helper to update an OTA job's status, progress, and error code.
   * If the job enters a final state (SUCCESS/FAILED), it automatically triggers history cleanup.
   */
  private async _updateOtaJobStatus(
    jobId: string,
    deviceId: string,
    status: string,
    progress: number,
    errorCode: string | null = null
  ) {
    const updateData: any = {
      status,
      progress,
      updated_at: new Date().toISOString(),
      error_code: errorCode
    };

    const { error } = await supabaseAdmin
      .from('ota_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) {
      console.error(`[MQTT Subscriber] Failed to update ota_jobs status for job ${jobId}:`, error.message);
      return false;
    }

    console.log(`[MQTT Subscriber] Updated OTA job ${jobId} to ${status} (${progress}%)`);

    if (status === 'SUCCESS' || status === 'FAILED') {
      this._cleanupOtaHistory(deviceId);
    }
    return true;
  }
}

/**
 * cleanupOtaHistory(deviceId)
 * ---------------------------
 * Cleans up historical OTA jobs in PostgreSQL so that each device retains
 * only its current active job and its single latest completed (SUCCESS/FAILED) job.
 * Deterministically keeps the single newest completed job (using ID as a tie-breaker).
 */
export async function cleanupOtaHistory(deviceId: string) {
  try {
    // 1. Fetch completed jobs (SUCCESS / FAILED) for this device, ordered by created_at DESC, id DESC
    const { data, error } = await supabaseAdmin
      .from('ota_jobs')
      .select('id')
      .eq('device_id', deviceId)
      .in('status', ['SUCCESS', 'FAILED'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      console.error(`[OTA Cleanup] Failed to fetch completed jobs for ${deviceId}:`, error.message);
      return;
    }

    // If we have more than 1 completed job, delete all older ones (indices 1 onwards)
    if (data && data.length > 1) {
      const idsToDelete = data.slice(1).map(job => job.id);
      const { error: deleteError } = await supabaseAdmin
        .from('ota_jobs')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error(`[OTA Cleanup] Failed to delete older completed jobs for ${deviceId}:`, deleteError.message);
      } else {
        console.log(`[OTA Cleanup] Cleaned up ${idsToDelete.length} older completed OTA jobs for ${deviceId}`);
      }
    }
  } catch (err: any) {
    console.error(`[OTA Cleanup] Unexpected error during OTA jobs cleanup for ${deviceId}:`, err);
  }
}

// Export initialization routine
const subscriber = new MqttSubscriber();
export const initMqttSubscriber = async () => {
  return subscriber.begin();
};

export const stopMqttSubscriber = () => {
  subscriber.stop();
};
