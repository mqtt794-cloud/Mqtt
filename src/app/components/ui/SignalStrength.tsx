/**
 * SignalStrength.tsx — Visual WiFi signal strength indicator
 * Converts RSSI dBm to a visual bar display with quality label.
 */

interface SignalStrengthProps {
  rssi?: number | null;
  className?: string;
}

function getSignalInfo(rssi: number | null | undefined): { bars: number; label: string; color: string } {
  if (rssi === null || rssi === undefined) {
    return { bars: 0, label: 'Unknown', color: 'text-slate-600' };
  }
  if (rssi >= -50) return { bars: 4, label: 'Excellent', color: 'text-emerald-400' };
  if (rssi >= -60) return { bars: 3, label: 'Good', color: 'text-emerald-400' };
  if (rssi >= -70) return { bars: 2, label: 'Fair', color: 'text-amber-400' };
  if (rssi >= -80) return { bars: 1, label: 'Weak', color: 'text-red-400' };
  return { bars: 1, label: 'Very Weak', color: 'text-red-400' };
}

export default function SignalStrength({ rssi, className = '' }: SignalStrengthProps) {
  const { bars, label, color } = getSignalInfo(rssi);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Signal bars */}
      <span className="flex items-end gap-[2px] h-3.5">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={`w-[3px] rounded-full ${
              level <= bars ? color.replace('text-', 'bg-') : 'bg-slate-700'
            }`}
            style={{
              height: `${4 + level * 3}px`,
              transition: 'background-color 220ms ease',
            }}
          />
        ))}
      </span>
      <span className={`text-[10px] font-semibold ${color}`} style={{ transition: 'color 220ms ease' }}>
        {label}
      </span>
    </span>
  );
}
