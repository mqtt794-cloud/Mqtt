/**
 * =============================================================================
 * RelayControl.tsx — Relay Switch Control Client Component
 * =============================================================================
 *
 * PURPOSE:
 *   Handles physical trigger switches (ON/OFF buttons) for a single relay channel.
 *   Flashes optimistic state feedback and executes control via the REST API.
 *   Invokes next/navigation `router.refresh()` to sync fresh states from the DB.
 * =============================================================================
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Power } from 'lucide-react';

interface RelayControlProps {
  deviceId: string;
  relayNumber: number;
  initialState: boolean;
}

export default function RelayControl({ deviceId, relayNumber, initialState }: RelayControlProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [optimisticState, setOptimisticState] = useState(initialState);

  // Sync state if initial state changes in parent server component
  if (initialState !== optimisticState && !loading) {
    setOptimisticState(initialState);
  }

  const handleControl = async (targetState: boolean) => {
    setLoading(true);
    setOptimisticState(targetState); // Optimistic UI update

    try {
      const response = await fetch('/api/device/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId,
          relay: relayNumber,
          state: targetState,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to control relay.');
      }

      // Allow 500ms for the MQTT roundtrip (ESP executing command -> publishing
      // state snapshot -> background subscriber writing it to Supabase)
      // then refresh page data.
      setTimeout(() => {
        router.refresh();
        setLoading(false);
      }, 500);
      
    } catch (err: any) {
      alert(err.message || 'API Communication failed.');
      setOptimisticState(initialState); // Rollback on error
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-2xl border border-slate-900 justify-between">
      {/* State indicator node */}
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full transition-all duration-300 ${
            optimisticState
              ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              : 'bg-slate-700'
          }`}
        />
        <span className="text-sm font-semibold text-slate-300">
          Channel {relayNumber}
        </span>
      </div>

      {/* Button Controls */}
      <div className="flex gap-2">
        {/* Toggle ON */}
        <button
          onClick={() => handleControl(true)}
          disabled={loading || optimisticState === true}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            optimisticState === true
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 disabled:opacity-50'
          }`}
        >
          ON
        </button>

        {/* Toggle OFF */}
        <button
          onClick={() => handleControl(false)}
          disabled={loading || optimisticState === false}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            optimisticState === false
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 disabled:opacity-50'
          }`}
        >
          OFF
        </button>
      </div>
    </div>
  );
}
