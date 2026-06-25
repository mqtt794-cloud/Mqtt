/**
 * StatusBadge.tsx — Premium animated status chip component
 * Provides consistent, smoothly-animated status indicators across the dashboard.
 * Colors crossfade on variant change with transition-all duration-500.
 */

type BadgeVariant = 'online' | 'offline' | 'pending' | 'syncing' | 'synced' | 'error' | 'success';

const variantConfig: Record<BadgeVariant, { dot: string; bg: string; text: string; border: string; pulse?: boolean }> = {
  online: {
    dot: 'bg-emerald-400',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  offline: {
    dot: 'bg-slate-500',
    bg: 'bg-slate-800/80',
    text: 'text-slate-400',
    border: 'border-slate-700/60',
  },
  pending: {
    dot: 'bg-amber-400',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    pulse: true,
  },
  syncing: {
    dot: 'bg-blue-400',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    pulse: true,
  },
  synced: {
    dot: 'bg-emerald-400',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  error: {
    dot: 'bg-red-400',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
  },
  success: {
    dot: 'bg-emerald-400',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

export default function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  const config = variantConfig[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all duration-500 ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span className={`absolute inset-0 rounded-full ${config.dot} opacity-75 animate-ping`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 transition-colors duration-500 ${config.dot}`} />
      </span>
      {label}
    </span>
  );
}
