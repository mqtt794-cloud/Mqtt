/**
 * =============================================================================
 * DeviceCard.tsx — Device Information & Relay Control Card
 * =============================================================================
 * Server component. Card never unmounts — only contents update.
 * Passes `online` to RelayCard so controls disable when offline.
 * Shows detailed connection quality.
 * =============================================================================
 */

import RelayCard from './RelayCard';
import RenameRelayButton from './RenameRelayButton';
import RefreshConfigButton from './RefreshConfigButton';
import OtaUpdatePanel from './OtaUpdatePanel';
import StatusBadge from '@/app/components/ui/StatusBadge';
import { Cpu, Clock, Wifi, WifiOff } from 'lucide-react';

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

function formatLastSeen(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 5)    return 'Just now';
  if (diffSec < 60)   return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString();
}

function getConnectionInfo(online: boolean, lastSeen: string | null) {
  if (!online) {
    return {
      variant: 'offline' as const,
      label: 'Offline',
      detail: lastSeen ? `Last seen ${formatLastSeen(lastSeen)}` : 'Never connected',
    };
  }
  if (!lastSeen) return { variant: 'online' as const, label: 'Connected', detail: 'MQTT connected' };
  const diffSec = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  if (diffSec < 30)  return { variant: 'online' as const, label: 'Connected', detail: `Last sync ${formatLastSeen(lastSeen)}` };
  if (diffSec < 120) return { variant: 'pending' as const, label: 'Reconnecting', detail: `Last sync ${formatLastSeen(lastSeen)}` };
  return { variant: 'offline' as const, label: 'Offline', detail: `Last seen ${formatLastSeen(lastSeen)}` };
}

export default function DeviceCard({ device, latestRelease }: DeviceCardProps) {
  const sortedRelays = [...device.relays].sort((a, b) => a.relay_number - b.relay_number);
  const connection = getConnectionInfo(device.online, device.last_seen);

  return (
    <div
      className="bg-slate-900 border border-slate-800/50 rounded-2xl p-5 sm:p-6 flex flex-col gap-5 shadow-lg shadow-black/10"
      style={{ transition: 'border-color 220ms ease, box-shadow 220ms ease' }}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white leading-tight truncate">
            {device.device_name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <code className="text-[10px] bg-slate-800/80 text-indigo-300/70 px-1.5 py-0.5 rounded border border-slate-700/40">
              {device.device_id}
            </code>
            {device.model && (
              <span className="text-[10px] text-slate-600 font-medium">{device.model}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <RefreshConfigButton deviceId={device.device_id} />
          <StatusBadge variant={connection.variant} label={connection.label} />
        </div>
      </div>

      {/* ── Connection Quality ── */}
      <div className="flex items-center gap-4 sm:gap-5 text-xs border-t border-slate-800/50 pt-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-slate-400">
          {device.online
            ? <Wifi className="w-3.5 h-3.5 text-emerald-500/70" />
            : <WifiOff className="w-3.5 h-3.5 text-slate-600" />
          }
          <span className="font-medium text-slate-500">{connection.detail}</span>
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-slate-600" />
          <span className="font-medium">
            {device.firmware_version ?? '—'}
            {device.build_number ? ` b${device.build_number}` : ''}
          </span>
        </span>
      </div>

      {/* ── Offline Banner ── */}
      {!device.online && (
        <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-2.5 text-xs text-slate-400">
          <WifiOff className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span>Device offline — controls disabled until reconnected</span>
        </div>
      )}

      {/* ── OTA ── */}
      <OtaUpdatePanel
        deviceId={device.device_id}
        currentVersion={device.firmware_version || '0.0.0'}
        latestRelease={latestRelease}
      />

      {/* ── Relay Channels ── */}
      {sortedRelays.length === 0 ? (
        <p className="text-xs text-slate-600 italic text-center py-4">
          No relay channels found for this device.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {sortedRelays.map((relay) => (
            <div key={relay.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  Ch {relay.relay_number}
                </span>
                <RenameRelayButton relayId={relay.id} currentName={relay.relay_name} />
              </div>
              <RelayCard
                deviceId={device.device_id}
                relayNumber={relay.relay_number}
                relayName={relay.relay_name}
                currentState={relay.current_state}
                switchMode={relay.switch_mode}
                desiredSwitchMode={relay.desired_switch_mode}
                configStatus={relay.config_status}
                online={device.online}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
