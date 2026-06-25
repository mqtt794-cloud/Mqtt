/**
 * =============================================================================
 * RelayToggle.tsx — Google Home-Style Relay Toggle
 * =============================================================================
 *
 * Adaptive Smart Sync Lock:
 *   1. Tap → lock + optimistic flip
 *   2. API call fires
 *   3. No automatic refresh — wait for server props to arrive naturally
 *   4. If server matches optimistic → unlock immediately
 *   5. Fallback at 5s: ONE router.refresh() + unlock
 *   6. API error → immediate revert + unlock
 *
 * Separate visual layers:
 *   - Relay State: ON / OFF (always visible, never replaced by "Syncing")
 *   - Sync Status: "Applying…" indicator (shown alongside state)
 *
 * Disabled when device is offline.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Power, WifiOff } from 'lucide-react';
import { useToast } from '@/app/components/ui/ToastProvider';

interface RelayToggleProps {
  deviceId: string;
  relayNumber: number;
  relayName: string;
  currentState: boolean;
  online: boolean;
}

export default function RelayToggle({ deviceId, relayNumber, relayName, currentState, online }: RelayToggleProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [optimisticState, setOptimisticState] = useState(currentState);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pulseActive, setPulseActive] = useState(false);
  const prevIsOnRef = useRef(optimisticState);

  // Trigger pulse animation when state flips
  useEffect(() => {
    if (optimisticState !== prevIsOnRef.current) {
      setPulseActive(true);
      const timer = setTimeout(() => setPulseActive(false), 800);
      prevIsOnRef.current = optimisticState;
      return () => clearTimeout(timer);
    }
  }, [optimisticState]);

  // ── Adaptive Sync: watch server props ──
  useEffect(() => {
    if (locked) {
      // Server confirmed → unlock immediately, cancel fallback
      if (currentState === optimisticState) {
        setLocked(false);
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
      }
    } else {
      // Not locked — accept server state (Alexa, physical switch, etc.)
      if (currentState !== optimisticState) {
        setOptimisticState(currentState);
      }
    }
  }, [currentState, optimisticState, locked]);

  useEffect(() => {
    return () => { if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current); };
  }, []);

  const handleToggle = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || !online) return;

    // Ripple
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setTimeout(() => setRipple(null), 500);
    }

    const targetState = !optimisticState;
    setOptimisticState(targetState);
    setLocked(true);
    setLoading(true);

    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);

    // Fallback at 5s — only refresh if still locked (server hasn't confirmed)
    fallbackTimerRef.current = setTimeout(() => {
      setLocked(false);
      fallbackTimerRef.current = null;
      router.refresh();
    }, 5000);

    try {
      const response = await fetch('/api/device/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, relay: relayNumber, state: targetState }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Control command failed.');
      }
      toast(`${relayName} turned ${targetState ? 'on' : 'off'}`, 'success');
    } catch (err: any) {
      setOptimisticState(!targetState);
      setLocked(false);
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      toast(err.message || 'Failed to control relay.', 'error');
    } finally {
      setLoading(false);
    }
  }, [loading, online, optimisticState, deviceId, relayNumber, relayName, router, toast]);

  const isOn = optimisticState;
  const isDisabled = !online;

  return (
    <button
      ref={cardRef}
      onClick={handleToggle}
      disabled={loading || isDisabled}
      id={`relay-toggle-${deviceId}-${relayNumber}`}
      role="switch"
      aria-checked={isOn}
      aria-label={`${relayName}: ${isDisabled ? 'Device offline' : isOn ? 'On' : 'Off'}`}
      className={`relative w-full overflow-hidden rounded-2xl border p-6 flex flex-col items-center gap-3 text-center cursor-pointer tap-highlight-none select-none ${
        isDisabled
          ? 'bg-slate-900/60 border-slate-800/30 opacity-60 cursor-not-allowed'
          : isOn
            ? 'bg-emerald-500/8 border-emerald-500/20'
            : 'bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/60'
      }`}
      style={{
        minHeight: 120,
        transition: 'transform 120ms cubic-bezier(0.2,0,0,1), background-color 180ms ease, border-color 180ms ease, box-shadow 300ms ease',
        boxShadow: isOn && !isDisabled ? '0 0 30px rgba(52,211,153,0.08)' : 'none',
      }}
      onPointerDown={(e) => { if (!isDisabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {/* Ripple */}
      {ripple && (
        <span
          className="absolute rounded-full bg-white/10 pointer-events-none"
          style={{
            left: ripple.x - 20, top: ripple.y - 20,
            width: 40, height: 40,
            animation: 'ripple 500ms ease-out forwards',
          }}
        />
      )}

      {/* Icon */}
      <div className={`flex items-center justify-center w-14 h-14 rounded-2xl ${
        isDisabled
          ? 'bg-slate-800/40 text-slate-600'
          : isOn
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-slate-700/30 text-slate-500'
      }`}
        style={{
          transition: 'background-color 180ms ease, color 180ms ease, box-shadow 300ms ease',
          boxShadow: isOn && !isDisabled ? '0 0 20px rgba(52,211,153,0.15)' : '0 0 0 transparent',
        }}
      >
        {isDisabled ? <WifiOff className="w-6 h-6" /> : <Power className="w-7 h-7" />}
      </div>

      {/* Name */}
      <span className="text-sm font-bold text-slate-100 truncate max-w-full">{relayName}</span>

      {/* ── Separate: Relay State + Sync Status ── */}
      <div className="flex flex-col items-center gap-1">
        {/* Relay State — always visible, never replaced */}
        <div className="flex items-center gap-3">
          <span className={`text-lg font-extrabold uppercase tracking-wider ${
            isDisabled ? 'text-slate-600' : isOn ? 'text-emerald-400' : 'text-slate-500'
          }`} style={{ transition: 'color 220ms ease' }}>
            {isDisabled ? 'Offline' : isOn ? 'On' : 'Off'}
          </span>

          {/* Toggle indicator */}
          <div className={`relative w-11 h-6 rounded-full flex-shrink-0 ${
            isDisabled ? 'bg-slate-700' : isOn ? 'bg-emerald-500' : 'bg-slate-600'
          }`} style={{ transition: 'background-color 180ms ease' }}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md ${
              isOn ? 'translate-x-5' : 'translate-x-0.5'
            }`} style={{ transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)' }} />
            {(loading || pulseActive) && (
              <div className="absolute inset-0 rounded-full border-2 border-amber-400/60 animate-ping" />
            )}
          </div>
        </div>

        {/* Sync Status — shown alongside, never replaces state */}
        {loading && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400">
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDuration: '800ms', animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDuration: '800ms', animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDuration: '800ms', animationDelay: '300ms' }} />
            </span>
            Applying
          </span>
        )}
      </div>
    </button>
  );
}
