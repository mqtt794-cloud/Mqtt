/**
 * =============================================================================
 * src/lib/alexa/powerController.ts — Alexa Smart Home Power Controller Service
 * =============================================================================
 *
 * PURPOSE:
 *   Handles power state directives (TurnOn / TurnOff) issued by Alexa.
 *   This service:
 *     1. Verifies that the requested device exists in your database and belongs
 *        to the requesting user (userId).
 *     2. Dispatches the command to the physical hardware via the secure MQTT broker.
 *     3. Logs the action in the `device_events` table for history and debugging.
 *
 * REUSABLE DESIGN:
 *   - Accepts `userId` as an argument to support future multi-user OAuth accounts.
 *   - Reuses the existing `mqttPublisher` singleton so we don't open multiple broker connections.
 *   - Follows the "no optimistic updates" pattern: database state is only updated
 *     after the ESP8266 executes the command and publishes back on home/+/state.
 * =============================================================================
 */

import { supabaseAdmin } from '../supabase';
import { mqttPublisher } from '../mqttPublisher';

export interface PowerControlResult {
  success: boolean;
  online: boolean;
}

/**
 * handleAlexaPowerControl(userId, deviceId, relayNumber, turnOn)
 * -------------------------------------------------------------
 * Performs authentication checks, logs events, and publishes control payloads to MQTT.
 *
 * @param userId      - Identifies the authenticated owner (e.g. 'admin')
 * @param deviceId    - Target device ID (e.g. 'ESP001')
 * @param relayNumber - Relay channel (1 to 4)
 * @param turnOn      - True for TurnOn, False for TurnOff
 * @returns Promise resolving to an object containing success and online flags.
 */
export async function handleAlexaPowerControl(
  userId: string,
  deviceId: string,
  relayNumber: number,
  turnOn: boolean
): Promise<PowerControlResult> {
  console.log(
    `[Alexa PowerController] Control request: device=${deviceId}, relay=${relayNumber}, state=${turnOn}, user=${userId}`
  );

  try {
    // 1. Ownership validation: Query the Supabase database.
    //    We check that the device exists and its home is owned by the requested userId.
    //    We also select the device's online status.
    const { data: deviceRecord, error: queryError } = await supabaseAdmin
      .from('devices')
      .select('device_id, online, model, homes(user_id)')
      .eq('device_id', deviceId)
      .single();

    if (queryError || !deviceRecord) {
      console.error(`[Alexa PowerController] Device ${deviceId} not found in database:`, queryError?.message);
      return { success: false, online: false };
    }

    const homes = deviceRecord.homes as any;
    if (homes?.user_id !== userId) {
      console.error(`[Alexa PowerController] Security alert: User ${userId} does not own device ${deviceId}.`);
      return { success: false, online: false };
    }

    // Dynamic model-based relay number validation
    const maxRelays = deviceRecord.model === '2CH_RELAY' ? 2 : 4;
    if (relayNumber < 1 || relayNumber > maxRelays) {
      console.error(`[Alexa PowerController] Invalid relay number ${relayNumber} for model ${deviceRecord.model}`);
      return { success: false, online: deviceRecord.online };
    }

    // 2. Publish command payload to HiveMQ Cloud.
    //    Reuses your standard mqttPublisher which appends a uuid cmdId.
    const cmdId = await mqttPublisher.publishControlCommand(deviceId, relayNumber, turnOn);

    if (!cmdId) {
      console.error(`[Alexa PowerController] Failed to publish MQTT command to broker.`);
      return { success: false, online: deviceRecord.online };
    }

    console.log(`[Alexa PowerController] Command [${cmdId}] published successfully.`);

    // 3. Log event into device_events
    //    This records that the action came from "Alexa" (distinguishing it from the dashboard UI).
    const { error: logError } = await supabaseAdmin
      .from('device_events')
      .insert({
        device_id: deviceId,
        event_type: 'CONTROL_CMD',
        payload: {
          cmdId,
          relay: relayNumber,
          state: turnOn,
        },
        source: 'Alexa',
      });

    if (logError) {
      console.error('[Alexa PowerController] Error logging event to database:', logError.message);
    }

    return { success: true, online: deviceRecord.online };
  } catch (err: any) {
    console.error('[Alexa PowerController] Unexpected exception in power controller handler:', err.message || err);
    return { success: false, online: false };
  }
}
