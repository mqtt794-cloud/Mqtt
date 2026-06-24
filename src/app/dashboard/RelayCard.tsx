/**
 * =============================================================================
 * RelayCard.tsx — Relay Channel Control Card with Switch Mode Config
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 *   This is a "Client Component" (runs in the browser). It renders a single
 *   relay channel card row with:
 *     - Upper Row: The relay name, status dot, current state badge, and [ON] / [OFF] control buttons.
 *     - Lower Row: A dropdown switch mode selector (SMART, CLASSIC, DETACHED) and a real-time Config Status Badge.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RelayCardProps {
  deviceId: string;          // The ESP device identifier, e.g. "ESP001"
  relayNumber: number;       // 1, 2, 3, or 4
  relayName: string;         // Human-readable name, e.g. "Bedroom Light"
  currentState: boolean;     // true = ON, false = OFF (from database)
  switchMode: string;        // Current switch mode (from database)
  desiredSwitchMode: string; // Target switch mode (from database)
  configStatus: string;      // 'SYNCED' or 'PENDING'
}

export default function RelayCard({
  deviceId,
  relayNumber,
  relayName,
  currentState,
  switchMode,
  desiredSwitchMode,
  configStatus,
}: RelayCardProps) {
  const router = useRouter();

  // loading: true while we are waiting for the power control API response
  const [loading, setLoading] = useState(false);

  // configLoading: true while we are waiting for the config API response
  const [configLoading, setConfigLoading] = useState(false);

  // error: stores an error message string if any API call fails
  const [error, setError] = useState<string | null>(null);

  /**
   * handleControl(targetState)
   * --------------------------
   * Called when the user clicks [ON] or [OFF].
   */
  const handleControl = async (targetState: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/device/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          relay: relayNumber,
          state: targetState,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Control command failed.');
      }

      // Immediately refresh the page data. Let the database/MQTT subscriber updates drive the UI.
      router.refresh();
      setLoading(false);

    } catch (err: any) {
      setError(err.message || 'Unknown error.');
      setLoading(false);
    }
  };

  /**
   * handleModeChange(newMode)
   * -------------------------
   * Called when the user selects a new switch mode from the dropdown.
   */
  const handleModeChange = async (newMode: 'SMART' | 'CLASSIC' | 'DETACHED') => {
    setConfigLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/device/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          relay: relayNumber,
          mode: newMode,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update switch mode.');
      }

      // Immediately refresh the page data to show the pending status
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Unknown error.');
    } finally {
      setConfigLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
      
      {/* Row 1: State dot, Name, ON/OFF buttons */}
      <div className="flex items-center justify-between gap-4">
        
        {/* LEFT SIDE: relay name + current state badge */}
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              currentState ? 'bg-emerald-400' : 'bg-slate-600'
            }`}
          />

          <span className="text-sm font-medium text-slate-200 truncate">
            {relayName}
          </span>

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
          {error && (
            <span className="text-xs text-red-400 hidden sm:block">{error}</span>
          )}

          {loading && (
            <span className="text-xs text-slate-500">Working…</span>
          )}

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

      {/* Row 2: Switch Mode Dropdown & Config Status Badge */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-800/60 pt-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Switch Mode:
          </span>
          <select
            value={desiredSwitchMode || 'SMART'}
            disabled={loading || configLoading}
            onChange={(e) => handleModeChange(e.target.value as any)}
            className="text-xs bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-colors disabled:opacity-50 cursor-pointer"
          >
            <option value="SMART">SMART</option>
            <option value="CLASSIC">CLASSIC</option>
            <option value="DETACHED">DETACHED</option>
          </select>
          {configLoading && (
            <span className="text-[10px] text-slate-500 animate-pulse">Syncing...</span>
          )}
        </div>

        {/* Config Status Badge */}
        <div className="flex items-center gap-1.5">
          {configStatus === 'PENDING' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-ping" />
              <span>Pending ({switchMode} → {desiredSwitchMode})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              <span>Synced ({switchMode})</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
