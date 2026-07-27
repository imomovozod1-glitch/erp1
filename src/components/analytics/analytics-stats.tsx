'use client'

import { useTranslations } from 'next-intl'
import { DollarSign, TrendingUp, Package, ShoppingCart } from 'lucide-react'
import { StatsCard } from '@/components/shared/stats-card'
import { formatCurrency } from '@/lib/utils'

interface AnalyticsStatsProps {
  totalRevenue: number
  totalProfit: number
  totalSold: number
  totalOrders: number
  avgOrderValue: number
}

export function AnalyticsStats({ totalRevenue, totalProfit, totalSold, totalOrders, avgOrderValue }: AnalyticsStatsProps) {
  const t = useTranslations('analytics')

  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0'

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title={t('totalRevenue')}
        value={formatCurrency(totalRevenue)}
        icon={DollarSign}
        iconClassName="bg-emerald-500"
      />
      <StatsCard
        title={t('totalProfit')}
        value={formatCurrency(totalProfit)}
        icon={TrendingUp}
        trend={{ value: Number(profitMargin), label: t('profitMargin') }}
        iconClassName="bg-blue-500"
      />
      <StatsCard
        title={t('totalSold')}
        value={totalSold}
        icon={Package}
        iconClassName="bg-purple-500"
      />
      <StatsCard
        title={t('totalOrders')}
        value={totalOrders}
        icon={ShoppingCart}
        trend={{ value: avgOrderValue > 0 ? Number((avgOrderValue / 1000).toFixed(0)) : 0, label: t('avgOrderValue') }}
        iconClassName="bg-amber-500"
      />
    </div>
  )
}
