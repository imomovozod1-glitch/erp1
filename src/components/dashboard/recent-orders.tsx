'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const STATUS_COLORS = {
  draft: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/50',
  pending: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/50',
  confirmed: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/50',
  shipped: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/50',
  delivered: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/50',
  cancelled: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/50',
}

interface RecentOrdersProps {
  orders: any[]
  lang: string
  title: string
}

export function RecentOrders({ orders, lang, title }: RecentOrdersProps) {
  const t = useTranslations('sales')
  const tCommon = useTranslations('common')

  if (orders.length === 0) {
    return (
      <Card className="col-span-1 md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">{t('recentOrders')}</CardTitle>
          <CardDescription>{tCommon('noData')}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</CardTitle>
        <Link
          href={`/${lang}/sales/orders`}
          className="text-xs text-violet-600 hover:text-violet-700 font-medium"
        >
          {tCommon('all')} →
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          { }
          {orders.map((order: any) => (
            <Link
              key={order.id}
              href={`/${lang}/sales/orders/${order.id}`}
              className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-violet-700 dark:text-violet-400 text-xs font-bold">
                  {order.customers?.name?.[0] ?? 'C'}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {order.order_number}
                  </p>
                  <p className="text-xs text-muted-foreground">{order.customers?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] ?? 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700'
                  }`}
                >
                  {t(`status.${order.status}`)}
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
