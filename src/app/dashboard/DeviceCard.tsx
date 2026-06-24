/**
 * =============================================================================
 * DeviceCard.tsx — Device Information & Relay Control Card
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 *   Renders a complete card for one ESP device. Shows:
 *     - Device name (e.g. "Living Room Controller")
 *     - Device ID badge (e.g. "ESP001")
 *     - Online / Offline status indicator
 *     - Firmware version and last-seen timestamp
 *     - A list of RelayCard components — one for each relay channel
 *
 * WHY THIS IS A SERVER COMPONENT:
 *   This file does NOT have 'use client'. That means Next.js renders it on the
 *   server. It receives its data as "props" from the parent page.tsx, which
 *   already fetched everything from Supabase.
 *   The child RelayCard.tsx IS a client component (has 'use client') and handles
 *   the browser-side button interactions.
 *
 * BEGINNER NOTE — Props:
 *   "Props" (short for properties) are the inputs a component receives.
 *   In JSX you pass them like HTML attributes:
 *     <DeviceCard device={deviceObject} />
 *   Inside the function you receive them as the first argument.
 * =============================================================================
 */

import RelayCard from './RelayCard';
import RenameRelayButton from './RenameRelayButton';
import RefreshConfigButton from './RefreshConfigButton';

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

interface DeviceCardProps {
  device: Device;
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
export default function DeviceCard({ device }: DeviceCardProps) {
  // Sort relays by their number (1, 2, 3, 4) so they always appear in order
  const sortedRelays = [...device.relays].sort(
    (a, b) => a.relay_number - b.relay_number
  );

  return (
    /*
     * Card container.
     * bg-slate-900: dark background.
     * border border-slate-800: subtle border line.
     * rounded-2xl: nicely rounded corners.
     * p-5: padding inside the card.
     */
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">

      {/* ── Device Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">

        {/* LEFT: device name + ID badge */}
        <div>
          <h3 className="text-base font-bold text-white leading-tight">
            {device.device_name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {/* Device ID chip — monospace font makes it look like a code tag */}
            <code className="text-xs bg-slate-800 text-indigo-300 px-2 py-0.5 rounded-md border border-slate-700">
              {device.device_id}
            </code>
            {/* Model label */}
            {device.model && (
              <span className="text-xs text-slate-500">{device.model}</span>
            )}
          </div>
        </div>

        {/* RIGHT: Online/Offline badge + Sync button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <RefreshConfigButton deviceId={device.device_id} />
          
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
              device.online
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
          >
            {/*
             * Status dot.
             * bg-emerald-400: bright green when online.
             * bg-slate-600: grey when offline.
             */}
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                device.online ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
            {device.online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* ── Device Metadata Row ───────────────────────────────────────── */}
      {/*
       * Shows firmware version and last-seen time.
       * text-xs: extra small text.
       * text-slate-500: muted grey colour.
       */}
      <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-800 pt-3">
        <span>
          Firmware:{' '}
          <span className="text-slate-400 font-medium">
            {device.firmware_version ?? '—'}
            {device.build_number ? ` (build ${device.build_number})` : ''}
          </span>
        </span>
        <span>
          Last seen:{' '}
          <span className="text-slate-400 font-medium">
            {formatLastSeen(device.last_seen)}
          </span>
        </span>
      </div>

      {/* ── Relay Channels ────────────────────────────────────────────── */}
      {sortedRelays.length === 0 ? (
        /*
         * Edge case: device has no relays in the database yet.
         * This shouldn't happen after claiming, but we handle it gracefully.
         */
        <p className="text-xs text-slate-600 italic">
          No relay channels found for this device.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {/*
           * Render one RelayCard per relay.
           * We also render a RenameRelayButton next to each one.
           */}
          {sortedRelays.map((relay) => (
            /*
             * key={relay.id}: React needs a unique "key" on each list item
             * so it can efficiently update the list when data changes.
             */
            <div key={relay.id} className="flex flex-col gap-1">

              {/* Relay name + rename button row */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  Ch {relay.relay_number}
                </span>
                {/*
                 * RenameRelayButton is a small pencil icon that opens a
                 * browser prompt() dialog for the user to type a new name.
                 */}
                <RenameRelayButton
                  relayId={relay.id}
                  currentName={relay.relay_name}
                />
              </div>

              {/*
               * RelayCard handles the actual ON/OFF button logic.
               * We pass all the data it needs as props.
               */}
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
