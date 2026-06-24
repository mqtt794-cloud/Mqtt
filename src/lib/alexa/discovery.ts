/**
 * =============================================================================
 * src/lib/alexa/discovery.ts — Alexa Smart Home Discovery Service
 * =============================================================================
 *
 * PURPOSE:
 *   Handles Amazon Alexa Smart Home Discovery (V3) directives.
 *   This service queries your Supabase database to find all devices and relays
 *   belonging to a specific user (userId), and formats them into the strict JSON
 *   structure that Alexa expects.
 *
 * HOW ALEXA DISCOVERY WORKS:
 *   1. When you say "Alexa, discover devices", Amazon sends a Discover directive
 *      to your Next.js endpoint.
 *   2. This service queries the database to find all user-owned relays.
 *   3. Each relay channel (e.g. Relay 1, Relay 2) is returned to Alexa as a
 *      distinct endpoint (e.g., ESP001_1, ESP001_2) so that Alexa sees them as
 *      separate devices (like "Bedroom Light" and "Fan").
 *   4. We declare capabilities for each endpoint: Alexa core, PowerController (ON/OFF),
 *      and EndpointHealth (Online/Offline status).
 *
 * KEY REUSABLE ADVANTAGES:
 *   - Parameterized userId: Designed to accept a dynamic userId to support future
 *     multi-user setups (e.g., through OAuth Account Linking).
 *   - Endpoint Cookie: We store 'deviceId' and 'relayNumber' in the endpoint's
 *     cookie. Alexa echoes this cookie back to us in all control commands. This
 *     means we don't have to parse strings later; we can directly read the database
 *     identities from the cookie!
 * =============================================================================
 */

import { supabaseAdmin } from '../supabase';
import { AlexaEndpoint } from './types';

/**
 * getAlexaEndpoints(userId)
 * -------------------------
 * Queries the database for all homes, devices, and relays owned by the specified userId.
 * Translates them into Alexa-compatible endpoints.
 *
 * @param userId - The ID of the owner user (e.g., 'admin')
 * @returns A promise resolving to an array of Alexa endpoints.
 */
export async function getAlexaEndpoints(userId: string): Promise<AlexaEndpoint[]> {
  console.log(`[Alexa Discovery] Starting discovery for user: ${userId}`);

  try {
    // 1. Fetch all homes owned by the user.
    //    We need this because devices are linked to homes, not users directly.
    const { data: homes, error: homesError } = await supabaseAdmin
      .from('homes')
      .select('id')
      .eq('user_id', userId);

    if (homesError) {
      console.error('[Alexa Discovery] Error fetching homes:', homesError.message);
      return [];
    }

    if (!homes || homes.length === 0) {
      console.log(`[Alexa Discovery] No homes found for user: ${userId}`);
      return [];
    }

    const homeIds = homes.map((home) => home.id);

    // 2. Fetch all devices inside those homes, including their nested relays.
    //    PostgREST retrieves the relationship automatically since relays contains a
    //    foreign key pointing to devices.
    const { data: devices, error: devicesError } = await supabaseAdmin
      .from('devices')
      .select(`
        device_id,
        device_name,
        online,
        model,
        relays (
          relay_number,
          relay_name,
          current_state
        )
      `)
      .in('home_id', homeIds);

    if (devicesError) {
      console.error('[Alexa Discovery] Error fetching devices and relays:', devicesError.message);
      return [];
    }

    if (!devices || devices.length === 0) {
      console.log('[Alexa Discovery] No devices found in user homes.');
      return [];
    }

    const alexaEndpoints: AlexaEndpoint[] = [];

    // 3. Loop through each device and convert its relays into individual Alexa endpoints.
    for (const dev of devices) {
      // Cast the joined relays array to help TypeScript resolve types
      const relays = (dev.relays as any[]) || [];

      for (const relay of relays) {
        // Alexa Discovery Update: Skip channels 3 and 4 for 2CH devices
        if (dev.model === '2CH_RELAY' && relay.relay_number > 2) {
          continue;
        }

        // Construct a unique endpoint ID for Alexa, e.g. "ESP001_1" for relay 1 on device ESP001
        const endpointId = `${dev.device_id}_${relay.relay_number}`;

        // Create the Alexa endpoint schema
        const endpoint: AlexaEndpoint = {
          endpointId,
          manufacturerName: 'SmartHome',
          friendlyName: relay.relay_name || `Relay ${relay.relay_number}`,
          description: `Relay channel ${relay.relay_number} on controller ${dev.device_name}`,
          
          // As per your request for V1, we report all relays as switches to keep it simple.
          displayCategories: ['SWITCH'],

          // The cookie acts as metadata. Alexa will echo this exact object back to us
          // on any control directive (like TurnOn/TurnOff). No string splitting required!
          cookie: {
            deviceId: dev.device_id,
            relayNumber: relay.relay_number.toString(),
          },

          // Declare the capabilities of this endpoint.
          // In Alexa V3, every endpoint MUST declare what interface capabilities it supports.
          capabilities: [
            // 1. Core Alexa Interface (mandatory for all smart home endpoints)
            {
              type: 'AlexaInterface',
              interface: 'Alexa',
              version: '3',
            },
            // 2. PowerController Interface (defines standard ON/OFF controls)
            {
              type: 'AlexaInterface',
              interface: 'Alexa.PowerController',
              version: '3',
              properties: {
                supported: [
                  { name: 'powerState' },
                ],
                proactivelyReported: false, // Set to true if you implement active reporting events later
                retrievable: true,          // Indicates Alexa can query the state via StateReports
              },
            },
            // 3. EndpointHealth Interface (reports whether device is online or offline)
            {
              type: 'AlexaInterface',
              interface: 'Alexa.EndpointHealth',
              version: '3',
              properties: {
                supported: [
                  { name: 'connectivity' },
                ],
                proactivelyReported: false,
                retrievable: true,
              },
            },
          ],
        };

        alexaEndpoints.push(endpoint);
      }
    }

    console.log(`[Alexa Discovery] Discovered ${alexaEndpoints.length} endpoints successfully.`);
    return alexaEndpoints;
  } catch (err: any) {
    console.error('[Alexa Discovery] Unexpected exception in discovery handler:', err.message || err);
    return [];
  }
}
