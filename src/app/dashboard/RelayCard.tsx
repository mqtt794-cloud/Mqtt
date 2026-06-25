/**
 * =============================================================================
 * RelayCard.tsx — Relay Channel Control Card with Switch Mode Config
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 *   This is a "Client Component" (runs in the browser). It renders a single
 *   relay channel card with:
 *     - A large, satisfying tap-target toggle (RelayToggle)
 *     - A touch-friendly mode selector (ModeSelector)
 *     - Premium status badges and animations
 */

'use client';

import RelayToggle from './RelayToggle';
import ModeSelector from './ModeSelector';

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
  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {/* Large tap-target relay toggle */}
      <RelayToggle
        deviceId={deviceId}
        relayNumber={relayNumber}
        relayName={relayName}
        currentState={currentState}
      />

      {/* Touch-friendly mode selector */}
      <ModeSelector
        deviceId={deviceId}
        relayNumber={relayNumber}
        currentMode={switchMode}
        desiredMode={desiredSwitchMode}
        configStatus={configStatus}
      />
    </div>
  );
}
