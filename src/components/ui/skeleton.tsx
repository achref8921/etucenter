export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-neutral-100 dark:bg-[#181b22] ${className}`} />;
}

export function SkeletonPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}
