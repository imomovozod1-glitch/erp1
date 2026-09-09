'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { StatusBadge } from '@/components/shared/status-badge'
import { orderStatusTone } from '@/lib/statuses'

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
                <StatusBadge tone={orderStatusTone(order.status)} label={t(`status.${order.status}`)} />
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
