import { NextRequest, NextResponse } from 'next/server';
import { updateRelayMode } from '@/app/dashboard/actions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, relay, mode } = body;

    if (!deviceId || typeof relay !== 'number' || !mode) {
      return NextResponse.json(
        { error: 'Invalid parameters. Required: deviceId (string), relay (number), mode (string).' },
        { status: 400 }
      );
    }

    const result = await updateRelayMode(deviceId, relay, mode);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API Config] Server error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
