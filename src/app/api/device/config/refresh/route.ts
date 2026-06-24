import { NextRequest, NextResponse } from 'next/server';
import { refreshDeviceConfig } from '@/app/dashboard/actions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Invalid parameters. Required: deviceId (string).' },
        { status: 400 }
      );
    }

    const result = await refreshDeviceConfig(deviceId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API Config Refresh] Server error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
