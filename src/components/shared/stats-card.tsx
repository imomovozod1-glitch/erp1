import { cn } from '@/lib/utils'
import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  className?: string
  iconClassName?: string
  valueClassName?: string
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  iconClassName,
  valueClassName,
}: StatsCardProps) {
  const isPositiveTrend = trend && trend.value >= 0

  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-slate-200/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800',
        className
      )}
    >
      {/* Brand glow in the top-right corner. Decorative only, and it warms on
          hover — enough to make the tile feel alive without animating a number. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl transition-opacity duration-300 group-hover:bg-violet-500/20 dark:bg-violet-500/10"
      />

      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </CardTitle>
        <div
          className={cn(
            'rounded-xl p-2 shadow-xs transition-transform duration-200 group-hover:scale-105',
            iconClassName ?? 'bg-violet-100 dark:bg-violet-950/50'
          )}
        >
          <Icon
            className={cn('h-4 w-4', iconClassName ? 'text-white' : 'text-violet-600 dark:text-violet-400')}
          />
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div
          className={cn(
            'text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-slate-100',
            valueClassName
          )}
        >
          {value}
        </div>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        {trend && (
          <div className="mt-2 flex items-center gap-1.5">
            {/* The arrow is an icon, not a bare ↑/↓ glyph, so direction survives
                font fallbacks — and the trend reads as a pill rather than
                loose text. */}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                isPositiveTrend
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
              )}
            >
              {isPositiveTrend ? (
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden="true" />
              )}
              {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
