/**
 * ModeSelector.tsx — Segmented pill selector
 * No automatic refresh. Only 5s fallback if server hasn't confirmed.
 * Disabled when device is offline.
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/ui/ToastProvider';

const MODES = ['SMART', 'CLASSIC', 'DETACHED'] as const;
type Mode = typeof MODES[number];

interface ModeSelectorProps {
  deviceId: string;
  relayNumber: number;
  currentMode: string;
  desiredMode: string;
  configStatus: string;
  online: boolean;
}

export default function ModeSelector({
  deviceId, relayNumber, currentMode, desiredMode, configStatus, online,
}: ModeSelectorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>(desiredMode || 'SMART');
  const [locked, setLocked] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (locked) {
      if (desiredMode === selectedMode) {
        setLocked(false);
        if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
      }
    } else {
      if (desiredMode !== selectedMode) setSelectedMode(desiredMode);
    }
  }, [desiredMode, selectedMode, locked]);

  useEffect(() => {
    return () => { if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current); };
  }, []);

  const isPending = configStatus === 'PENDING';
  const isDisabled = !online;

  const handleModeChange = useCallback(async (newMode: Mode) => {
    if (loading || newMode === selectedMode || isDisabled) return;
    setSelectedMode(newMode);
    setLocked(true);
    setLoading(true);

    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      setLocked(false);
      fallbackTimerRef.current = null;
      router.refresh();
    }, 5000);

    try {
      const response = await fetch('/api/device/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, relay: relayNumber, mode: newMode }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update switch mode.');
      }
      toast(`Mode set to ${newMode}`, 'success');
    } catch (err: any) {
      setSelectedMode(desiredMode);
      setLocked(false);
      if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
      toast(err.message || 'Failed to change mode.', 'error');
    } finally {
      setLoading(false);
    }
  }, [loading, selectedMode, isDisabled, deviceId, relayNumber, desiredMode, router, toast]);

  return (
    <div className={`flex flex-col gap-2 ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Switch Mode
        </span>
        {(isPending || loading) && !isDisabled && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400">
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '800ms' }} />
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '800ms' }} />
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '800ms' }} />
            </span>
            {loading ? 'Saving' : 'Syncing'}
          </span>
        )}
      </div>

      <div className="flex rounded-xl bg-slate-800/50 border border-slate-700/40 p-0.5" role="radiogroup" aria-label="Switch mode">
        {MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            disabled={loading || isDisabled}
            role="radio"
            aria-checked={selectedMode === mode}
            className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-bold cursor-pointer tap-highlight-none ${
              selectedMode === mode
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            } ${loading || isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ transition: 'all 180ms ease' }}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}
