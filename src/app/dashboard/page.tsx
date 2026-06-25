/**
 * =============================================================================
 * page.tsx — Dashboard Server Component Page
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 *   Main dashboard page — the control center for your smart home.
 *   Runs on the SERVER. Fetches data from Supabase, renders HTML.
 *
 * LAYOUT:
 *   Mobile: Devices first, FAB opens BottomSheet for setup forms.
 *   Desktop: Left sidebar (setup forms) + right content (devices).
 *
 * DATA SHAPE:
 *   homes[] → devices[] → relays[]
 * =============================================================================
 */

import { redirect }      from 'next/navigation';
import { cookies }       from 'next/headers';
import { createClientOnServer } from '@/lib/supabase';
import { logout } from '../login/actions';

import DeviceCard      from './DeviceCard';
import CreateHomeForm  from './CreateHomeForm';
import ClaimDeviceForm from './ClaimDeviceForm';
import DashboardShell  from './DashboardShell';
import ActivityStrip   from './ActivityStrip';
import MobileFAB       from './MobileFAB';

import { Cpu, Home, ShieldAlert, LogOut, Radio, Sparkles } from 'lucide-react';

// --------------------------------------------------------------------------
export default async function DashboardPage() {

  // ── 1. AUTH CHECK ──────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  if (session !== 'authenticated') {
    redirect('/login');
  }

  // ── 2. DATA FETCH ─────────────────────────────────────────────────────
  const supabase = await createClientOnServer();

  const latestReleaseMap: Record<string, any> = {};
  try {
    const { data: releases } = await supabase
      .from('firmware_releases')
      .select('id, version, firmware_url, sha256, firmware_size, compatible_model, release_notes, is_stable, minimum_firmware_version')
      .eq('is_stable', true)
      .order('created_at', { ascending: false });
    if (releases) {
      for (const rel of releases) {
        if (!latestReleaseMap[rel.compatible_model]) {
          latestReleaseMap[rel.compatible_model] = rel;
        }
      }
    }
  } catch (err) {
    console.error('[Dashboard] Failed to fetch latest firmware releases:', err);
  }

  const { data: homes, error } = await supabase
    .from('homes')
    .select(`
      id,
      name,
      devices (
        id,
        device_id,
        device_name,
        online,
        last_seen,
        firmware_version,
        build_number,
        model,
        relays (
          id,
          relay_number,
          relay_name,
          current_state,
          switch_mode,
          desired_switch_mode,
          config_status
        )
      )
    `)
    .eq('user_id', 'admin')
    .order('name');

  if (error) {
    console.error("[Dashboard] Database query failed:", error);
    throw new Error(`Database query failed: ${error.message} (code: ${error.code})`);
  }

  const { data: unclaimedDevices } = await supabase
    .from('device_registry')
    .select('device_id, model')
    .eq('claimed', false)
    .order('device_id');

  const typedHomes     = homes            || [];
  const typedUnclaimed = unclaimedDevices || [];

  const totalDevices = typedHomes.reduce(
    (sum, home) => sum + (home.devices?.length ?? 0),
    0
  );

  // Collect all devices for ActivityStrip
  const allDevices = typedHomes.flatMap(h =>
    (h.devices || []).map(d => ({
      device_id: d.device_id,
      device_name: d.device_name,
      online: d.online,
      last_seen: d.last_seen,
    }))
  );

  // ── 3. RENDER ─────────────────────────────────────────────────────────
  return (
    <DashboardShell>
      <div className="min-h-screen bg-slate-950 text-white">

        {/* ── TOP NAVIGATION BAR ──────────────────────────────────── */}
        <header className="sticky top-0 z-50 glass border-b border-slate-800/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                <Cpu className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight">SmartHome</span>
              <span className="hidden sm:block text-slate-600 text-sm">Control Panel</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
                <span>{typedHomes.length} home{typedHomes.length !== 1 ? 's' : ''}</span>
                <span className="text-slate-700">·</span>
                <span>{totalDevices} device{totalDevices !== 1 ? 's' : ''}</span>
              </div>

              <a
                href="/dashboard/firmware"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition-colors tap-highlight-none"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Firmware</span>
              </a>

              <form action={logout}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition-colors cursor-pointer tap-highlight-none"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* ── ACTIVITY STRIP ──────────────────────────────────────── */}
        {allDevices.length > 0 && (
          <ActivityStrip devices={allDevices} />
        )}

        {/* ── MAIN CONTENT ────────────────────────────────────────── */}
        {typedHomes.length === 0 ? (
          /* ── PREMIUM ONBOARDING ── */
          <main className="max-w-lg mx-auto px-6 py-24 flex flex-col items-center text-center animate-fade-in">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-2xl scale-150" />
              <div className="relative p-6 bg-slate-900/80 border border-slate-800/60 rounded-3xl">
                <Home className="w-12 h-12 text-indigo-400" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-white mb-2">
              Welcome to SmartHome
            </h1>
            <p className="text-sm text-slate-400 mb-8 max-w-xs leading-relaxed">
              Your smart home dashboard is ready. Create your first home to start managing devices.
            </p>
            <div className="w-full max-w-sm">
              <CreateHomeForm />
            </div>
          </main>
        ) : (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

            {/* ── LEFT SIDEBAR: Setup Forms (desktop only) ── */}
            <aside className="hidden lg:block lg:sticky lg:top-20 space-y-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
                Setup
              </h2>
              <CreateHomeForm />
              {typedHomes.length > 0 && (
                <ClaimDeviceForm
                  homes={typedHomes.map((h) => ({ id: h.id, name: h.name }))}
                  unclaimedDevices={typedUnclaimed}
                />
              )}
              {typedUnclaimed.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Radio className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">
                      {typedUnclaimed.length} Discovered Device{typedUnclaimed.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    New ESP device{typedUnclaimed.length !== 1 ? 's' : ''} detected. Use the form above to claim.
                  </p>
                </div>
              )}
            </aside>

            {/* ── RIGHT PANEL: Homes & Devices ── */}
            <section className="space-y-8 min-w-0">
              {typedHomes.map((home) => (
                <div key={home.id}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                      <Home className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h2 className="text-base font-bold text-slate-200">{home.name}</h2>
                    <span className="text-xs text-slate-600 font-medium">
                      ({home.devices?.length ?? 0} device{home.devices?.length !== 1 ? 's' : ''})
                    </span>
                  </div>

                  {(!home.devices || home.devices.length === 0) ? (
                    <div className="flex flex-col items-center py-12 text-center bg-slate-900/30 border border-slate-800/40 rounded-2xl">
                      <Radio className="w-8 h-8 text-slate-600 mb-3" />
                      <p className="text-sm text-slate-500">No devices in this home yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {home.devices.map((device) => (
                        <DeviceCard
                          key={device.id}
                          device={{
                            ...device,
                            relays: (device.relays as any[]) ?? [],
                          }}
                          latestRelease={latestReleaseMap[device.model || '2CH_RELAY'] || null}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          </main>
        )}

        {/* ── MOBILE FAB + BOTTOM SHEET ── */}
        {typedHomes.length > 0 && (
          <MobileFAB
            homes={typedHomes.map((h) => ({ id: h.id, name: h.name }))}
            unclaimedDevices={typedUnclaimed}
          />
        )}
      </div>
    </DashboardShell>
  );
}
