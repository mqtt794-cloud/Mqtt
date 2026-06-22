/**
 * =============================================================================
 * route.ts — REST API Endpoint for Relay Control (Static Auth Version)
 * =============================================================================
 *
 * PATH:
 *   POST /api/device/control
 *
 * SECURITY:
 *   1. Bypasses Supabase Auth. Resolves static session from 'admin_session' cookie.
 *   2. Verifies ownership by confirming the device belongs to a home owned
 *      by 'admin'.
 *   3. Publishes command to HiveMQ Cloud.
 *   4. Logs event in `device_events`.
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClientOnServer } from '@/lib/supabase';
import { mqttPublisher } from '@/lib/mqttPublisher';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify static session cookie
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session')?.value;

    if (session !== 'authenticated') {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // 2. Parse request payload
    const body = await request.json();
    const { deviceId, relay, state } = body;

    if (!deviceId || typeof relay !== 'number' || typeof state !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid parameters. Required: deviceId (string), relay (number 1-4), state (boolean).' },
        { status: 400 }
      );
    }

    if (relay < 1 || relay > 4) {
      return NextResponse.json({ error: 'Relay number must be between 1 and 4.' }, { status: 400 });
    }

    const supabase = await createClientOnServer();

    // 3. Verify device ownership under static 'admin' profile
    const { data: deviceRecord, error: queryError } = await supabase
      .from('devices')
      .select('device_id, homes(user_id)')
      .eq('device_id', deviceId)
      .single();

    if (queryError || !deviceRecord) {
      return NextResponse.json({ error: 'Device not found.' }, { status: 404 });
    }

    const homes = deviceRecord.homes as any;
    if (homes?.user_id !== 'admin') {
      return NextResponse.json({ error: 'Access denied. You do not own this device.' }, { status: 403 });
    }

    // 4. Publish control command via MQTT Publisher
    console.log(`[API Control] Administrator triggering relay ${relay} to state ${state} on ${deviceId}`);
    const cmdId = await mqttPublisher.publishControlCommand(deviceId, relay, state);

    if (!cmdId) {
      return NextResponse.json({ error: 'Failed to publish command to broker.' }, { status: 500 });
    }

    // 5. Log command event in the database
    await supabase
      .from('device_events')
      .insert({
        device_id: deviceId,
        event_type: 'CONTROL_CMD',
        payload: {
          cmdId,
          relay,
          state
        },
        source: 'Dashboard'
      });

    return NextResponse.json({ success: true, cmdId });

  } catch (error: any) {
    console.error('[API Control] Server error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
