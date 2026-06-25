/**
 * =============================================================================
 * RelayToggle.tsx — Large Tap-Target Relay Toggle
 * =============================================================================
 *
 * The centerpiece control. A large, satisfying toggle card:
 *  - Full card is tap target (min 80px height)
 *  - Optimistic state with 5-second grace period (no flicker)
 *  - No router.refresh() — state stays until server naturally catches up
 *  - Ripple + scale press animation
 *  - Glow border when ON
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { Power } from 'lucide-react';
import { useToast } from '@/app/components/ui/ToastProvider';

interface RelayToggleProps {
  deviceId: string;
  relayNumber: number;
  relayName: string;
  currentState: boolean;
}

const GRACE_PERIOD_MS = 5000; // Ignore server state for 5s after toggle

export default function RelayToggle({ deviceId, relayNumber, relayName, currentState }: RelayToggleProps) {
  const { toast } = useToast();
  const [optimisticState, setOptimisticState] = useState(currentState);
  const [loading, setLoading] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const lastActionRef = useRef<number>(0);

  // Sync with server state ONLY if grace period has elapsed and not loading
  if (currentState !== optimisticState && !loading) {
    const elapsed = Date.now() - lastActionRef.current;
    if (elapsed > GRACE_PERIOD_MS) {
      setOptimisticState(currentState);
    }
  }

  const handleToggle = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) return;

    // Ripple effect at tap point
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setTimeout(() => setRipple(null), 600);
    }

    const targetState = !optimisticState;
    setOptimisticState(targetState); // Instant visual update
    lastActionRef.current = Date.now(); // Start grace period
    setLoading(true);

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

      // Success — keep optimistic state, no router.refresh()
      toast(`${relayName} turned ${targetState ? 'on' : 'off'}`, 'success');
    } catch (err: any) {
      setOptimisticState(!targetState); // Revert only on error
      lastActionRef.current = 0; // Clear grace period on error
      toast(err.message || 'Failed to control relay.', 'error');
    } finally {
      setLoading(false);
    }
  }, [loading, optimisticState, deviceId, relayNumber, relayName, toast]);

  const isOn = optimisticState;

  return (
    <button
      ref={cardRef}
      onClick={handleToggle}
      disabled={loading}
      id={`relay-toggle-${deviceId}-${relayNumber}`}
      className={`relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 cursor-pointer tap-highlight-none active-press ${ 
        isOn
          ? 'bg-emerald-500/8 border-emerald-500/25 shadow-[0_0_24px_rgba(52,211,153,0.1)]'
          : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/60'
      }`}
      style={{ minHeight: 80 }}
      aria-label={`${relayName}: ${isOn ? 'On' : 'Off'}. Tap to toggle.`}
    >
      {/* Ripple Effect */}
      {ripple && (
        <span
          className="absolute rounded-full bg-white/10 pointer-events-none"
          style={{
            left: ripple.x - 20,
            top: ripple.y - 20,
            width: 40,
            height: 40,
            animation: 'ripple 600ms ease-out forwards',
          }}
        />
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Left: Icon + Name + Status */}
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${
              isOn
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.15)]'
                : 'bg-slate-700/40 text-slate-500'
            }`}
          >
            <Power className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-100 truncate">{relayName}</p>
            <p className={`text-xs font-semibold transition-colors duration-300 ${
              loading
                ? 'text-amber-400'
                : isOn ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              {loading ? 'Syncing…' : isOn ? 'On' : 'Off'}
            </p>
          </div>
        </div>

        {/* Right: Toggle Switch */}
        <div
          className={`relative w-14 h-8 rounded-full transition-colors duration-300 flex-shrink-0 ${
            isOn ? 'bg-emerald-500' : 'bg-slate-600'
          }`}
        >
          <div
            className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
              isOn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
          {/* Loading ring pulse */}
          {loading && (
            <div className="absolute inset-0 rounded-full border-2 border-amber-400/50 animate-ping" />
          )}
        </div>
      </div>
    </button>
  );
}
