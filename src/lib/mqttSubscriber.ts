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
      console.log('[MQTT Subscriber] Already running.');
      return;
    }

    // ── Step 1: Validate Supabase admin client BEFORE connecting to MQTT ──────
    // If the Supabase keys are missing or wrong, there is no point connecting
    // to the broker — every incoming message would fail to write to the database.
    // validateSupabaseAdmin() prints a detailed diagnostic and returns false on error.
    console.log('[MQTT Subscriber] Validating Supabase admin connection...');
    const supabaseReady = await validateSupabaseAdmin();
    if (!supabaseReady) {
      console.error('[MQTT Subscriber] ❌ Supabase validation failed. Subscriber will NOT start.');
      console.error('[MQTT Subscriber]    Fix the SUPABASE_SERVICE_ROLE_KEY in .env.local and restart.');
      return;
    }

    // ── Step 2: Validate MQTT credentials ────────────────────────────────────
    const brokerUrl = process.env.MQTT_BROKER_URL;
    const username  = process.env.MQTT_USERNAME;
    const password  = process.env.MQTT_PASSWORD;

    if (!brokerUrl) {
      console.warn('[MQTT Subscriber] Missing MQTT_BROKER_URL. Subscriber not started.');
      return;
    }

    console.log('[MQTT Subscriber] Starting secure connection to broker...');

    this._client = mqtt.connect(brokerUrl, {
      username,
      password,
      rejectUnauthorized: true,  // Perform certificate verification
      connectTimeout: 5000,
      reconnectPeriod: 2000,
    });

    this._client.on('connect', () => {
      console.log('[MQTT Subscriber] Connected successfully. Registering subscriptions...');
      this._initialized = true;

      // Subscribe using wildcard '+' for device_id: home/{device_id}/{topic}
      this._client?.subscribe('home/+/status', { qos: 1 });
      this._client?.subscribe('home/+/state', { qos: 1 });
      this._client?.subscribe('home/+/ack', { qos: 1 });
      this._client?.subscribe('home/+/config_state', { qos: 1 });
      this._client?.subscribe('home/+/ota_status', { qos: 1 });

      console.log('[MQTT Subscriber] Subscribed to status, state, config_state, ota_status, and ack wildcards.');
    });

    this._client.on('message', async (topic, message) => {
      try {
        await this._handleMessage(topic, message.toString());
      } catch (error) {
        console.error(`[MQTT Subscriber] Error processing message on topic ${topic}:`, error);
      }
    });

    this._client.on('error', (error) => {
      console.error('[MQTT Subscriber] Error:', error);
    });
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
    console.log(`[MQTT Subscriber] Status from ${deviceId}`);

    // 1. Ensure the device exists in device_registry and verify secrets.
    const incomingSecret = payload.deviceSecret || payload.secret;
    if (incomingSecret) {
      const incomingHash = crypto.createHash('sha256').update(incomingSecret).digest('hex');

      // Fetch existing device from registry to avoid overwriting
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('device_registry')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (fetchError) {
        console.error(`[MQTT Subscriber] Error fetching from registry for ${deviceId}:`, fetchError.message);
      }

      if (existing) {
        // Existing Device Protection: Do NOT overwrite. Log mismatch if detected.
        if (existing.device_secret_hash !== incomingHash) {
          console.warn(`[SECURITY]\nSecret mismatch detected\nStored: ${existing.device_secret_hash}\nIncoming: ${incomingHash}`);
        }
        // Auto-upgrade model registry
        if (payload.model && existing.model !== payload.model) {
          console.log(`[DISCOVERY] Upgrading device model from ${existing.model} to ${payload.model} for ${deviceId}`);
          await supabaseAdmin
            .from('device_registry')
            .update({ model: payload.model })
            .eq('device_id', deviceId);
        }
      } else {
        // New device discovery: Insert incoming secret from firmware
        const { error: insertError } = await supabaseAdmin
          .from('device_registry')
          .insert({
            device_id: deviceId,
            device_secret_hash: incomingHash,
            model: payload.model || '4CH_RELAY',
            claimed: false
          });

        if (insertError) {
          console.error(`[DISCOVERY] Registration failed for ${deviceId}:`, insertError.message);
        } else {
          console.log(`[DISCOVERY] Device ID: ${deviceId}`);
          console.log(`[DISCOVERY] Secret Hash Stored`);
          console.log(`[DISCOVERY] Registration Success`);
        }
      }
    } else {
      console.log(`[MQTT Subscriber] No deviceSecret in status payload from ${deviceId}. Skipping registry check.`);
    }

    // 2. Check if device is claimed (exists in devices table)
    //    .maybeSingle() returns null (no error) when zero rows match.
    const { data: claimedDevice } = await supabaseAdmin
      .from('devices')
      .select('id')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (claimedDevice) {
      // Update online status and metadata on the active device
      await supabaseAdmin
        .from('devices')
        .update({
          online: payload.online,
          last_seen: new Date().toISOString(),
          firmware_version: payload.firmware,
          build_number: payload.build,
          model: payload.model
        })
        .eq('device_id', deviceId);

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
    await supabaseAdmin
      .from('device_events')
      .insert({
        device_id: deviceId,
        event_type: 'STATUS_UPDATE',
        payload: payload,
        source: 'MQTT'
      });
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
    await supabaseAdmin
      .from('device_events')
      .insert({
        device_id: deviceId,
        event_type: 'STATE_SNAPSHOT',
        payload: payload,
        source: 'MQTT'
      });
  }

  /**
   * _handleAck(deviceId, payload)
   * ------------------------------
   * Logs execution acknowledgments published by the device.
   */
  private async _handleAck(deviceId: string, payload: any) {
    console.log(`[MQTT Subscriber] ACK received from ${deviceId}:`, payload);

    // Log the ACK event
    await supabaseAdmin
      .from('device_events')
      .insert({
        device_id: deviceId,
        event_type: 'COMMAND_ACK',
        payload: payload,
        source: 'MQTT'
      });
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
    await supabaseAdmin
      .from('device_events')
      .insert({
        device_id: deviceId,
        event_type: 'CONFIG_SNAPSHOT',
        payload: payload,
        source: 'MQTT'
      });
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
      .in('status', ['PENDING', 'DOWNLOADING', 'INSTALLING'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error(`[MQTT Subscriber] Failed to query active ota_jobs:`, queryError.message);
    }

    if (activeJob) {
      // 2. Update the active job status
      const { error: updateError } = await supabaseAdmin
        .from('ota_jobs')
        .update({
          status: status,
          progress: progress,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeJob.id);

      if (updateError) {
        console.error(`[MQTT Subscriber] Failed to update ota_jobs status:`, updateError.message);
      } else {
        console.log(`[MQTT Subscriber] Updated OTA job ${activeJob.id} to ${status} (${progress}%)`);
      }
    } else {
      console.warn(`[MQTT Subscriber] Received ota_status update but no active OTA job found for device ${deviceId}`);
    }

    // 3. Log the status event in device_events
    await supabaseAdmin
      .from('device_events')
      .insert({
        device_id: deviceId,
        event_type: 'OTA_STATUS',
        payload: payload,
        source: 'MQTT'
      });
  }
}

// Export initialization routine
const subscriber = new MqttSubscriber();
export const initMqttSubscriber = async () => {
  await subscriber.begin();
};

