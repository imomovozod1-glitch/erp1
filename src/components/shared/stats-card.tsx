import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  className?: string
  iconClassName?: string
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  iconClassName,
}: StatsCardProps) {
  const isPositiveTrend = trend && trend.value >= 0

  return (
    <Card className={cn('relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow duration-200', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn('p-2 rounded-lg', iconClassName ?? 'bg-indigo-50')}>
          <Icon className={cn('h-4 w-4', iconClassName ? 'text-white' : 'text-indigo-600')} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <p className={cn('text-xs font-medium mt-1', isPositiveTrend ? 'text-emerald-600' : 'text-red-500')}>
            {isPositiveTrend ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
