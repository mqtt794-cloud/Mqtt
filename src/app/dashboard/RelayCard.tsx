/**
 * =============================================================================
 * RelayCard.tsx — Relay Channel Control with Mode Selector
 * =============================================================================
 * Passes `online` to child components to disable interactions when offline.
 */

'use client';

import RelayToggle from './RelayToggle';
import ModeSelector from './ModeSelector';

interface RelayCardProps {
  deviceId: string;
  relayNumber: number;
  relayName: string;
  currentState: boolean;
  switchMode: string;
  desiredSwitchMode: string;
  configStatus: string;
  online: boolean;
}

export default function RelayCard({
  deviceId, relayNumber, relayName, currentState,
  switchMode, desiredSwitchMode, configStatus, online,
}: RelayCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <RelayToggle
        deviceId={deviceId}
        relayNumber={relayNumber}
        relayName={relayName}
        currentState={currentState}
        online={online}
      />
      <ModeSelector
        deviceId={deviceId}
        relayNumber={relayNumber}
        currentMode={switchMode}
        desiredMode={desiredSwitchMode}
        configStatus={configStatus}
        online={online}
      />
    </div>
  );
}
