/**
 * StatusBadge.tsx — Animated status chip component
 * Smooth 500ms color crossfade between states.
 * Pending/syncing states show animated bouncing dots.
 */

type BadgeVariant = 'online' | 'offline' | 'pending' | 'syncing' | 'synced' | 'error' | 'success';

const variantConfig: Record<BadgeVariant, { dot: string; bg: string; text: string; border: string; animated?: boolean }> = {
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
    animated: true,
  },
  syncing: {
    dot: 'bg-blue-400',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    animated: true,
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${config.bg} ${config.text} ${config.border} ${className}`}
      style={{ transition: 'all 500ms ease' }}
    >
      {config.animated ? (
        /* Animated bouncing dots for pending/syncing states */
        <span className="flex gap-[3px] items-center">
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-bounce`} style={{ animationDelay: '0ms', animationDuration: '800ms' }} />
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-bounce`} style={{ animationDelay: '200ms', animationDuration: '800ms' }} />
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-bounce`} style={{ animationDelay: '400ms', animationDuration: '800ms' }} />
        </span>
      ) : (
        /* Static dot with optional pulse ring for online */
        <span className="relative flex h-2 w-2">
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} style={{ transition: 'background-color 500ms ease' }} />
        </span>
      )}
      {label}
    </span>
  );
}
