/**
 * ActivityStrip.tsx — Live activity status bar
 * Shows the most recent device activity below the main nav.
 * Data comes from server-rendered props (no separate fetch).
 */

import { Wifi, WifiOff, Clock, RefreshCw } from 'lucide-react';

interface DeviceActivity {
  device_id: string;
  device_name: string;
  online: boolean;
  last_seen: string | null;
}

interface ActivityStripProps {
  devices: DeviceActivity[];
}

function getTimeDiff(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString();
}

export default function ActivityStrip({ devices }: ActivityStripProps) {
  if (devices.length === 0) return null;

  const onlineCount = devices.filter(d => d.online).length;
  const offlineCount = devices.length - onlineCount;

  // Find the most recently seen device
  const mostRecent = devices
    .filter(d => d.last_seen)
    .sort((a, b) => new Date(b.last_seen!).getTime() - new Date(a.last_seen!).getTime())[0];

  return (
    <div className="bg-slate-900/50 border-b border-slate-800/40 px-4 sm:px-6 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-4 text-xs text-slate-500 overflow-x-auto">
        {/* Online/Offline summary */}
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400 font-semibold">{onlineCount}</span>
          <span>online</span>
        </span>

        {offlineCount > 0 && (
          <span className="flex items-center gap-1.5 flex-shrink-0">
            <WifiOff className="w-3 h-3 text-slate-600" />
            <span className="text-slate-400">{offlineCount}</span>
            <span>offline</span>
          </span>
        )}

        <span className="text-slate-800">·</span>

        {/* Most recent activity */}
        {mostRecent && (
          <span className="flex items-center gap-1.5 flex-shrink-0 text-slate-400">
            <Clock className="w-3 h-3" />
            <span className="font-medium text-slate-300">{mostRecent.device_name}</span>
            <span>{getTimeDiff(mostRecent.last_seen)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
