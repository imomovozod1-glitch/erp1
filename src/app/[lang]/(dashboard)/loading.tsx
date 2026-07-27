import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page Header Skeleton */}
      <div className="space-y-2 px-4 md:px-8 pt-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-64" />
      </div>

      {/* Stats cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4 md:px-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Table area */}
      <div className="px-4 md:px-8">
        <div className="rounded-xl border bg-card">
          <div className="p-4 border-b flex items-center gap-3">
            <Skeleton className="h-9 w-64 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg ml-auto" />
          </div>
          <div className="p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-3 py-3 border-b last:border-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
