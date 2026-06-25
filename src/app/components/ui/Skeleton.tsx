/**
 * Skeleton.tsx — Shimmer skeleton loading primitives
 * Used throughout the dashboard to replace loading spinners with premium shimmer effects.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-shimmer ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return (
    <div
      className="rounded-full animate-shimmer"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded-md animate-shimmer ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}
