/**
 * =============================================================================
 * RelayCard.tsx — Relay Channel Control Card
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 *   This is a "Client Component" (runs in the browser). It renders a single
 *   relay channel row with:
 *     - The relay's name (e.g. "Bedroom Light")
 *     - A badge showing the current state: ON (green) or OFF (grey)
 *     - Two buttons: [ON] and [OFF]
 *
 * HOW BUTTON CLICKS WORK:
 *   1. User clicks [ON] or [OFF].
 *   2. We POST to /api/device/control with the device ID, relay number, and
 *      desired state (true = ON, false = OFF).
 *   3. The API publishes an MQTT command to the ESP device.
 *   4. We wait 600ms (time for ESP to execute and publish its new state back
 *      to the cloud subscriber, which then writes it to Supabase).
 *   5. We call router.refresh() — this re-runs the Server Component (page.tsx)
 *      and re-fetches fresh data from Supabase. The page re-renders with the
 *      real new state.
 *   NO OPTIMISTIC UPDATES: The displayed state only changes after the database
 *   confirms it. This avoids showing wrong state if the ESP fails to execute.
 *
 * BEGINNER NOTE — 'use client':
 *   Next.js renders most pages on the server. But components with onClick,
 *   useState, or other browser features must be marked 'use client' so Next.js
 *   knows to bundle them for the browser.
 * =============================================================================
 */

'use client'; // This directive tells Next.js: "run this in the browser"

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// --------------------------------------------------------------------------
// Type definition — describes what data this component expects from its parent
// --------------------------------------------------------------------------
interface RelayCardProps {
  deviceId: string;    // The ESP device identifier, e.g. "ESP001"
  relayNumber: number; // 1, 2, 3, or 4
  relayName: string;   // Human-readable name, e.g. "Bedroom Light"
  currentState: boolean; // true = ON, false = OFF (from database)
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export default function RelayCard({
  deviceId,
  relayNumber,
  relayName,
  currentState,
}: RelayCardProps) {
  // useRouter lets us call router.refresh() to re-fetch server-side data
  const router = useRouter();

  // loading: true while we are waiting for the API response + DB to settle
  // We show a "Working…" indicator and disable both buttons during this time
  const [loading, setLoading] = useState(false);

  // error: stores an error message string if the API call fails
  const [error, setError] = useState<string | null>(null);

  /**
   * handleControl(targetState)
   * --------------------------
   * Called when the user clicks [ON] (targetState = true)
   * or [OFF] (targetState = false).
   */
  const handleControl = async (targetState: boolean) => {
    setLoading(true); // Disable buttons, show loading indicator
    setError(null);   // Clear any previous error message

    try {
      // POST to the API route we already built
      const response = await fetch('/api/device/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,         // e.g. "ESP001"
          relay: relayNumber, // e.g. 1
          state: targetState, // true or false
        }),
      });

      // If the server returned an error status (4xx or 5xx), throw an error
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Control command failed.');
      }

      // Wait 600ms for the MQTT roundtrip:
      //   Dashboard → MQTT broker → ESP executes → ESP publishes state →
      //   MQTT subscriber → Supabase database updated
      // After that delay, refresh the page data from the database.
      setTimeout(() => {
        router.refresh(); // Re-runs page.tsx on the server, gets fresh DB data
        setLoading(false);
      }, 600);

    } catch (err: any) {
      // If anything went wrong, show the error and stop loading
      setError(err.message || 'Unknown error.');
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    /*
     * Outer container: a horizontal row with space between the label side
     * and the button side. `flex items-center justify-between` = flex row,
     * vertically centered, with items pushed to opposite ends.
     */
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">

      {/* LEFT SIDE: relay name + current state badge */}
      <div className="flex items-center gap-3 min-w-0">

        {/*
         * State indicator dot.
         * When ON (currentState = true): emerald green.
         * When OFF (currentState = false): slate grey.
         */}
        <span
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            currentState ? 'bg-emerald-400' : 'bg-slate-600'
          }`}
        />

        {/* Relay name — truncated with ellipsis if too long */}
        <span className="text-sm font-medium text-slate-200 truncate">
          {relayName}
        </span>

        {/*
         * Current state badge.
         * "Current State: ON" shown in green.
         * "Current State: OFF" shown in grey.
         */}
        <span
          className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${
            currentState
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-slate-800 text-slate-500 border-slate-700'
          }`}
        >
          {currentState ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* RIGHT SIDE: error text + ON/OFF buttons + loading state */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Show error message inline if API call fails */}
        {error && (
          <span className="text-xs text-red-400 hidden sm:block">{error}</span>
        )}

        {/* Loading indicator shown while waiting for MQTT roundtrip */}
        {loading && (
          <span className="text-xs text-slate-500">Working…</span>
        )}

        {/*
         * [ON] Button
         * -----------
         * - Disabled when loading OR already in ON state.
         * - When active (OFF state): slate background, turns green on hover.
         * - When already ON: emerald tinted, disabled appearance.
         */}
        <button
          id={`relay-on-${deviceId}-${relayNumber}`}
          onClick={() => handleControl(true)}
          disabled={loading || currentState === true}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors
            ${
              currentState === true
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 cursor-default'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 cursor-pointer disabled:opacity-40'
            }
          `}
        >
          ON
        </button>

        {/*
         * [OFF] Button
         * ------------
         * - Disabled when loading OR already in OFF state.
         * - When active (ON state): slate background, turns red on hover.
         * - When already OFF: slate tinted, disabled appearance.
         */}
        <button
          id={`relay-off-${deviceId}-${relayNumber}`}
          onClick={() => handleControl(false)}
          disabled={loading || currentState === false}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors
            ${
              currentState === false
                ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-default'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-red-600 hover:text-white hover:border-red-500 cursor-pointer disabled:opacity-40'
            }
          `}
        >
          OFF
        </button>
      </div>
    </div>
  );
}
