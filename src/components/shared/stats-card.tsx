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

  // Figma layout: the icon tile and the trend share the top row, the label sits
  // under them, then the figure. `iconClassName` (a solid colour) still turns the
  // tile into a filled one with a white icon, as many pages pass it.
  const trendPill = trend ? (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
        isPositiveTrend
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
      )}
    >
      {/* An icon, not a bare ↑/↓ glyph, so direction survives font fallbacks. */}
      {isPositiveTrend ? (
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
      ) : (
        <TrendingDown className="h-3 w-3" aria-hidden="true" />
      )}
      {Math.abs(trend.value)}%
    </span>
  ) : null

  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className
      )}
    >
      {/* Brand glow in the top-right corner. Decorative only, and it warms on
          hover — enough to make the tile feel alive without animating a number. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl transition-opacity duration-300 group-hover:bg-violet-500/20"
      />

      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0">
        <div
          className={cn(
            'rounded-2xl p-2.5 shadow-xs transition-transform duration-200 group-hover:scale-105',
            iconClassName ?? 'bg-violet-100 dark:bg-violet-500/15'
          )}
        >
          <Icon
            className={cn('h-5 w-5', iconClassName ? 'text-white' : 'text-violet-700 dark:text-violet-300')}
          />
        </div>
        {trendPill}
      </CardHeader>

      <CardContent className="relative">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div
          className={cn(
            'mt-1 text-2xl font-extrabold tracking-tight text-foreground tabular-nums',
            valueClassName
          )}
        >
          {value}
        </div>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        {trend && <p className="mt-1 text-xs text-muted-foreground">{trend.label}</p>}
      </CardContent>
    </Card>
  )
}
