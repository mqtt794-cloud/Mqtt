import { Skeleton } from '@/app/components/ui/Skeleton';

export default function DeviceCardSkeleton() {
  return (
    <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-5 flex flex-col gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>

      {/* Metadata */}
      <div className="flex gap-4 border-t border-slate-800/60 pt-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Relay cards */}
      <div className="flex flex-col gap-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-800/40 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
              <Skeleton className="h-7 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
