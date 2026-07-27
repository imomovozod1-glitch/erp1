import { Skeleton } from '@/components/ui/skeleton'

function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4 border-b flex items-center gap-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="ml-auto">
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
      <div className="p-2">
        {/* Header row */}
        <div className="flex items-center gap-4 px-3 py-2 mb-1">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3 border-t">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton
                key={j}
                className={`h-4 ${j === 0 ? 'w-40' : j === cols - 1 ? 'w-8' : 'w-24'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function InventoryLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 px-4 md:px-8 pt-2">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      <div className="px-4 md:px-8">
        <TableSkeleton rows={10} cols={6} />
      </div>
    </div>
  )
}
