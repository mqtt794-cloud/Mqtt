/**
 * =============================================================================
 * mqttPublisher.ts — Secure MQTT Command Publisher with Command IDs
 * =============================================================================
 *
 * PURPOSE:
 *   Manages a persistent singleton MQTT client connection. Exposes a simple,
 *   reusable function to publish control commands to smart relay devices.
 *
 * COMMAND ACKNOWLEDGEMENT SCHEMA:
 *   Every command published includes a unique `cmdId` generated using the
 *   native Node.js `crypto` library. This allows the backend to track when
 *   the ESP device successfully executes the request and sends back an 'ack' packet.
 *
 * payload schema:
 *   - For setting state: {"cmdId": "uuid", "relay": 1, "state": true}
 *   - For toggling:      {"cmdId": "uuid", "relay": 1, "action": "toggle"}
 * =============================================================================
 */

import mqtt from 'mqtt';
import crypto from 'crypto';

class MqttPublisher {
  private _client: mqtt.MqttClient | null = null;

  /**
   * connect()
   * ---------
   * Connects to the secure broker (port 8883) if not already connected.
   */
  public connect(): mqtt.MqttClient {
    if (this._client && this._client.connected) {
      return this._client;
    }

    const brokerUrl = process.env.MQTT_BROKER_URL;
    const username  = process.env.MQTT_USERNAME;
    const password  = process.env.MQTT_PASSWORD;

    if (!brokerUrl) {
      throw new Error('[MQTT Publisher] Missing MQTT_BROKER_URL in environment configuration.');
    }

    console.log('[MQTT Publisher] Initializing connection to secure broker:', brokerUrl);

    this._client = mqtt.connect(brokerUrl, {
      username,
      password,
      rejectUnauthorized: true,  // Perform certificate verification for secure connection
      connectTimeout: 5000,
      reconnectPeriod: 2000,
    });

    this._client.on('connect', () => {
      console.log('[MQTT Publisher] Successfully connected to secure broker.');
    });

    this._client.on('error', (error) => {
      console.error('[MQTT Publisher] Connection/Socket error:', error);
    });

    return this._client;
  }

  /**
   * publishControlCommand(deviceId, relayNumber, stateOrAction)
   * -----------------------------------------------------------
   * Formulates the JSON command payload with a unique cmdId and publishes it.
   *
   * @param deviceId      Identifier of the target device (e.g. ESP001)
   * @param relayNumber   Relay channel number (1 to 4)
   * @param stateOrAction Target state (true/false) OR action string ('toggle')
   * @returns             Promise resolving to the generated cmdId, or null on error
   */
  public publishControlCommand(
    deviceId: string,
    relayNumber: number,
    stateOrAction: boolean | 'toggle'
  ): Promise<string | null> {
    const client = this.connect();
    const topic = `home/${deviceId}/cmd`;
    const cmdId = crypto.randomUUID();

    // Construct the payload with cmdId for tracking acknowledgements
    const payloadObject: Record<string, any> = {
      cmdId: cmdId,
      relay: relayNumber
    };

    if (typeof stateOrAction === 'boolean') {
      payloadObject.state = stateOrAction;
    } else {
      payloadObject.action = stateOrAction;
    }

    const payloadString = JSON.stringify(payloadObject);

    return new Promise((resolve) => {
      client.publish(topic, payloadString, { qos: 1 }, (error) => {
        if (error) {
          console.error(`[MQTT Publisher] Failed to publish command ${cmdId} to ${topic}:`, error);
          resolve(null);
        } else {
          console.log(`[MQTT Publisher] Published [${cmdId}] to [${topic}]: ${payloadString}`);
          resolve(cmdId);
        }
      });
    });
  }
}

// Export singleton instance
export const mqttPublisher = new MqttPublisher();
