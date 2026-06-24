/**
 * =============================================================================
 * page.tsx — Dashboard Server Component Page
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 *   This is the main dashboard page — the control center for your smart home.
 *   It runs on the SERVER (no 'use client') which means:
 *     - It fetches data directly from Supabase before the page is sent to the browser.
 *     - The browser receives fully-rendered HTML — faster and more secure.
 *
 * PAGE SECTIONS:
 *   1. AUTH CHECK — Reads the 'admin_session' cookie. Redirects to /login if missing.
 *   2. DATA FETCH — Fetches homes → devices → relays in one nested query.
 *   3. LAYOUT:
 *       Left sidebar  → Setup forms (Create Home, Claim Device)
 *       Right content → Home sections with DeviceCards
 *
 * BEGINNER NOTE — Server Components:
 *   In Next.js 13+, every file in the `app/` folder is a Server Component by
 *   default. They can use async/await to fetch data. They cannot use useState
 *   or onClick — those require 'use client'.
 *
 * DATA SHAPE (what comes back from Supabase):
 *   homes[] → each home has:
 *     devices[] → each device has:
 *       relays[] → each relay has: name, number, current_state
 * =============================================================================
 */

// Next.js server utilities
import { redirect }      from 'next/navigation';
import { cookies }       from 'next/headers';

// Supabase client configured for server-side usage
import { createClientOnServer } from '@/lib/supabase';

// Server action called by the Sign Out button (defined in login/actions.ts)
import { logout } from '../login/actions';

// Our new focused components
import DeviceCard      from './DeviceCard';
import CreateHomeForm  from './CreateHomeForm';
import ClaimDeviceForm from './ClaimDeviceForm';

// Lucide icons — a library of clean SVG icons
import { Cpu, Home, ShieldAlert, LogOut, Radio } from 'lucide-react';

// --------------------------------------------------------------------------
// Page Component (async because it fetches data before rendering)
// --------------------------------------------------------------------------
export default async function DashboardPage() {

  // ── 1. AUTH CHECK ────────────────────────────────────────────────────────
  /*
   * cookies() reads the HTTP request cookies.
   * We look for 'admin_session' which is set by the login action.
   * If it's not 'authenticated', we redirect to the login page.
   * redirect() throws internally (it's not a normal return), so no code
   * after it runs.
   */
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;

  if (session !== 'authenticated') {
    redirect('/login');
  }

  // ── 2. DATA FETCH ─────────────────────────────────────────────────────────
  /*
   * createClientOnServer() returns a Supabase client that reads cookies
   * automatically (for Row-Level Security if we use it).
   *
   * The query below uses Supabase's nested select syntax:
   *   'homes' → include nested 'devices' → include nested 'relays'
   * This avoids three separate queries and returns everything in one call.
   */
  const supabase = await createClientOnServer();

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
    .order('name');   // Sort homes alphabetically

  console.log("========== DASHBOARD DEBUG ==========");
  console.log("Homes Error:", error);
  console.log("Homes Data:", JSON.stringify(homes, null, 2));
  console.log("Homes Count:", homes?.length);
  console.log("=====================================");

  // Fetch unclaimed devices so ClaimDeviceForm can show a dropdown
  const { data: unclaimedDevices } = await supabase
    .from('device_registry')
    .select('device_id, model')
    .eq('claimed', false)
    .order('device_id');

  // Use empty arrays as fallback if query returns null
  const typedHomes     = homes            || [];
  const typedUnclaimed = unclaimedDevices || [];

  // Count total devices across all homes (used in summary header)
  const totalDevices = typedHomes.reduce(
    (sum, home) => sum + (home.devices?.length ?? 0),
    0
  );

  // ── 3. RENDER ─────────────────────────────────────────────────────────────
  return (
    /*
     * Page root: full-height, dark background.
     * min-h-screen: at least the full viewport height.
     * bg-slate-950: very dark blue-grey (the darkest shade in Tailwind).
     */
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── TOP NAVIGATION BAR ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

          {/* Brand / logo area */}
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-bold text-white tracking-tight">
              SmartHome
            </span>
            <span className="hidden sm:block text-slate-600 text-sm">
              Control Panel
            </span>
          </div>

          {/* Summary stats + sign out */}
          <div className="flex items-center gap-4">
            {/* Live counts */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
              <span>{typedHomes.length} home{typedHomes.length !== 1 ? 's' : ''}</span>
              <span className="text-slate-700">·</span>
              <span>{totalDevices} device{totalDevices !== 1 ? 's' : ''}</span>
            </div>

            {/* Sign out button — submits a form that calls the logout server action */}
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
      {/*
       * Two-column layout on large screens, single column on mobile.
       * gap-6: space between the two columns.
       * max-w-7xl mx-auto: centers content and limits max width.
       */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

        {/* ── LEFT SIDEBAR: Setup Forms ────────────────────────────── */}
        {/*
         * lg:col-span-1: takes the left column only on large screens.
         * sticky top-20: the sidebar stays visible as you scroll the right panel.
         * space-y-4: vertical gap between forms.
         */}
        <aside className="lg:sticky lg:top-20 space-y-4">

          {/* Section label */}
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
            Setup
          </h2>

          {/* Form: create a new home location */}
          <CreateHomeForm />

          {/*
           * Form: claim a discovered ESP device.
           * Only shown if at least one home exists — you need a home
           * before you can assign a device to it.
           */}
          {typedHomes.length > 0 ? (
            <ClaimDeviceForm
              homes={typedHomes.map((h) => ({ id: h.id, name: h.name }))}
              unclaimedDevices={typedUnclaimed}
            />
          ) : (
            /*
             * Placeholder shown when no home has been created yet.
             * ShieldAlert icon signals that an action is required first.
             */
            <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5 text-center">
              <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Create a home location first to start claiming smart devices.
              </p>
            </div>
          )}

          {/* Discovered (unclaimed) devices notice */}
          {typedUnclaimed.length > 0 && typedHomes.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-400">
                  {typedUnclaimed.length} Discovered Device{typedUnclaimed.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                New ESP device{typedUnclaimed.length !== 1 ? 's' : ''} detected on the network.
                Use the form above to claim and name {typedUnclaimed.length !== 1 ? 'them' : 'it'}.
              </p>
            </div>
          )}
        </aside>

        {/* ── RIGHT PANEL: Homes & Devices ────────────────────────── */}
        <section className="space-y-8 min-w-0">

          {typedHomes.length === 0 ? (

            /* Empty state — no homes created yet */
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Home className="w-12 h-12 text-slate-700 mb-4" />
              <h3 className="text-base font-bold text-slate-400 mb-1">
                No homes yet
              </h3>
              <p className="text-sm text-slate-600 max-w-xs">
                Create your first home location using the panel on the left to
                get started.
              </p>
            </div>

          ) : (

            /* Render each home and its devices */
            typedHomes.map((home) => (
              <div key={home.id}>

                {/* Home name heading */}
                <div className="flex items-center gap-2 mb-4">
                  <Home className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <h2 className="text-base font-bold text-slate-200">
                    {home.name}
                  </h2>
                  {/* Device count badge next to home name */}
                  <span className="text-xs text-slate-600">
                    ({home.devices?.length ?? 0} device{home.devices?.length !== 1 ? 's' : ''})
                  </span>
                </div>

                {(!home.devices || home.devices.length === 0) ? (

                  /* Empty state — home has no devices yet */
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-8 text-center">
                    <p className="text-sm text-slate-600">
                      No devices in this home. Claim a device using the sidebar.
                    </p>
                  </div>

                ) : (

                  /*
                   * Device grid.
                   * On small screens: single column.
                   * On medium screens (768px+): two columns.
                   * gap-4: space between cards.
                   */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {home.devices.map((device) => (
                      /*
                       * DeviceCard renders the device header + all relay controls.
                       * We pass the full device object as a prop.
                       */
                      <DeviceCard
                        key={device.id}
                        device={{
                          ...device,
                          // Supabase returns relays as any[]; we cast it safely
                          relays: (device.relays as any[]) ?? [],
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
