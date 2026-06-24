import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const now = new Date();
    
    // 1. Timeout for downloading/installing: 10 minutes
    const downloadTimeoutLimit = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const { data: downloadStaleJobs, error: downloadErr } = await supabaseAdmin
      .from('ota_jobs')
      .update({ status: 'FAILED', error_code: 'DOWNLOAD_TIMEOUT', updated_at: now.toISOString() })
      .in('status', ['PENDING', 'DOWNLOADING', 'INSTALLING'])
      .lt('updated_at', downloadTimeoutLimit)
      .select('id, device_id');

    if (downloadErr) {
      console.error('[Watchdog API] Failed to clean up downloading/installing jobs:', downloadErr.message);
    } else if (downloadStaleJobs && downloadStaleJobs.length > 0) {
      console.log(`[Watchdog API] Timed out ${downloadStaleJobs.length} active downloading jobs:`, downloadStaleJobs);
    }

    // 2. Timeout for rebooting (Rollback detection): 5 minutes
    const rollbackLimit = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const { data: rollbackJobs, error: rollbackErr } = await supabaseAdmin
      .from('ota_jobs')
      .update({ status: 'FAILED', error_code: 'ROLLBACK_DETECTED', updated_at: now.toISOString() })
      .eq('status', 'REBOOTING')
      .lt('updated_at', rollbackLimit)
      .select('id, device_id');

    if (rollbackErr) {
      console.error('[Watchdog API] Failed to clean up rebooting/rollback jobs:', rollbackErr.message);
    } else if (rollbackJobs && rollbackJobs.length > 0) {
      console.log(`[Watchdog API] Rolled back ${rollbackJobs.length} rebooting jobs (timeout):`, rollbackJobs);
    }

    return NextResponse.json({
      success: true,
      cleanedActive: downloadStaleJobs?.length ?? 0,
      cleanedRebooting: rollbackJobs?.length ?? 0
    });
  } catch (err: any) {
    console.error('[Watchdog API] Global error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
