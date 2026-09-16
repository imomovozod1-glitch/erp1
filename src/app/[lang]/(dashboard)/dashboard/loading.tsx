import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shown the moment the dashboard is navigated to — most visibly right after
 * signing in. Without it the login button kept spinning until every dashboard
 * query had finished, which read as the login itself being slow.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border bg-card p-4 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
