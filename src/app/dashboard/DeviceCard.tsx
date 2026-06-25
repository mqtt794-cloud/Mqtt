/**
 * =============================================================================
 * DeviceCard.tsx — Device Information & Relay Control Card
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 *   Renders a complete card for one ESP device. Shows:
 *     - Device name with premium typography
 *     - Device ID badge and model label
 *     - Online / Offline status indicator (StatusBadge)
 *     - Firmware version, last-seen, and sync button
 *     - Embedded OTA update panel
 *     - A list of RelayCard components — one for each relay channel
 *
 * WHY THIS IS A SERVER COMPONENT:
 *   This file does NOT have 'use client'. That means Next.js renders it on the
 *   server. It receives its data as "props" from the parent page.tsx, which
 *   already fetched everything from Supabase.
 * =============================================================================
 */

import RelayCard from './RelayCard';
import RenameRelayButton from './RenameRelayButton';
import RefreshConfigButton from './RefreshConfigButton';
import OtaUpdatePanel from './OtaUpdatePanel';
import StatusBadge from '@/app/components/ui/StatusBadge';
import { Cpu, Clock, Wifi } from 'lucide-react';

// --------------------------------------------------------------------------
// Type definitions — describe the shape of data this component expects
// --------------------------------------------------------------------------

interface Relay {
  id: string;
  relay_number: number;
  relay_name: string;
  current_state: boolean;
  switch_mode: string;
  desired_switch_mode: string;
  config_status: string;
}

interface Device {
  id: string;
  device_id: string;
  device_name: string;
  online: boolean;
  last_seen: string | null;
  firmware_version: string | null;
  build_number: number | null;
  model: string | null;
  relays: Relay[];
}

interface FirmwareRelease {
  id: string;
  version: string;
  firmware_url: string;
  sha256: string;
  firmware_size: number;
  compatible_model: string;
  release_notes: string | null;
  is_stable: boolean;
  minimum_firmware_version: string | null;
}

interface DeviceCardProps {
  device: Device;
  latestRelease: FirmwareRelease | null;
}

// --------------------------------------------------------------------------
// Helper: format "last seen" timestamp into a human-readable string
// --------------------------------------------------------------------------
function formatLastSeen(isoString: string | null): string {
  if (!isoString) return 'Never';

  const date = new Date(isoString);
  const now  = new Date();

  // Calculate how many seconds ago the device was last seen
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60)  return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;

  // For older timestamps, show the date
  return date.toLocaleDateString();
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export default function DeviceCard({ device, latestRelease }: DeviceCardProps) {

  // Sort relays by their number (1, 2, 3, 4) so they always appear in order
  const sortedRelays = [...device.relays].sort(
    (a, b) => a.relay_number - b.relay_number
  );

  return (
    <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-5 sm:p-6 flex flex-col gap-5 animate-fade-in shadow-xl shadow-black/10">

      {/* ── Device Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">

        {/* LEFT: device name + ID badge */}
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white leading-tight truncate">
            {device.device_name}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Device ID chip — monospace font makes it look like a code tag */}
            <code className="text-xs bg-slate-800/80 text-indigo-300 px-2 py-0.5 rounded-md border border-slate-700/60">
              {device.device_id}
            </code>
            {/* Model label */}
            {device.model && (
              <span className="text-xs text-slate-500 font-medium">{device.model}</span>
            )}
          </div>
        </div>

        {/* RIGHT: Online/Offline badge + Sync button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <RefreshConfigButton deviceId={device.device_id} />
          <StatusBadge
            variant={device.online ? 'online' : 'offline'}
            label={device.online ? 'Online' : 'Offline'}
          />
        </div>
      </div>

      {/* ── Device Metadata Row ───────────────────────────────────────── */}
      <div className="flex items-center gap-4 sm:gap-5 text-xs text-slate-500 border-t border-slate-800/60 pt-3 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-400 font-medium">
            {device.firmware_version ?? '—'}
            {device.build_number ? ` (b${device.build_number})` : ''}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-400 font-medium">
            {formatLastSeen(device.last_seen)}
          </span>
        </span>
      </div>

      {/* Embedded OTA Update Panel */}
      <OtaUpdatePanel
        deviceId={device.device_id}
        currentVersion={device.firmware_version || '0.0.0'}
        latestRelease={latestRelease}
      />

      {/* ── Relay Channels ────────────────────────────────────────────── */}
      {sortedRelays.length === 0 ? (
        <p className="text-xs text-slate-600 italic text-center py-4">
          No relay channels found for this device.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {sortedRelays.map((relay) => (
            <div key={relay.id} className="flex flex-col gap-1.5">

              {/* Relay name + rename button row */}
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  Ch {relay.relay_number}
                </span>
                <RenameRelayButton
                  relayId={relay.id}
                  currentName={relay.relay_name}
                />
              </div>

              <RelayCard
                deviceId={device.device_id}
                relayNumber={relay.relay_number}
                relayName={relay.relay_name}
                currentState={relay.current_state}
                switchMode={relay.switch_mode}
                desiredSwitchMode={relay.desired_switch_mode}
                configStatus={relay.config_status}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
