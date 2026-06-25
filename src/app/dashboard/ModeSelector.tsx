/**
 * =============================================================================
 * ModeSelector.tsx — Touch-Friendly Segmented Mode Selector
 * =============================================================================
 *
 * Replaces the tiny <select> dropdown with a segmented pill control.
 * Uses optimistic state with grace period — no router.refresh().
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/app/components/ui/ToastProvider';

const MODES = ['SMART', 'CLASSIC', 'DETACHED'] as const;
type Mode = typeof MODES[number];

const GRACE_PERIOD_MS = 5000;

interface ModeSelectorProps {
  deviceId: string;
  relayNumber: number;
  currentMode: string;
  desiredMode: string;
  configStatus: string;
}

export default function ModeSelector({
  deviceId,
  relayNumber,
  currentMode,
  desiredMode,
  configStatus,
}: ModeSelectorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>(desiredMode || 'SMART');
  const lastActionRef = useRef<number>(0);

  // Sync with server state only after grace period
  if (desiredMode !== selectedMode && !loading) {
    const elapsed = Date.now() - lastActionRef.current;
    if (elapsed > GRACE_PERIOD_MS) {
      setSelectedMode(desiredMode);
    }
  }

  const isPending = configStatus === 'PENDING';

  const handleModeChange = useCallback(async (newMode: Mode) => {
    if (loading || newMode === selectedMode) return;
    setSelectedMode(newMode); // Optimistic
    lastActionRef.current = Date.now();
    setLoading(true);

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

      toast(`Mode set to ${newMode}`, 'success');
    } catch (err: any) {
      setSelectedMode(desiredMode); // Rollback
      lastActionRef.current = 0;
      toast(err.message || 'Failed to change mode.', 'error');
    } finally {
      setLoading(false);
    }
  }, [loading, selectedMode, deviceId, relayNumber, desiredMode, toast]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Switch Mode
        </span>
        {(isPending || loading) && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            {loading ? 'Saving…' : `Syncing (${currentMode} → ${desiredMode})`}
          </span>
        )}
      </div>

      <div className="flex rounded-xl bg-slate-800/50 border border-slate-700/40 p-0.5">
        {MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            disabled={loading}
            className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer tap-highlight-none ${ 
              selectedMode === mode
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}
