'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const STATUS_COLORS = {
  draft: 'bg-blue-50 text-blue-700 border-blue-200/60',
  pending: 'bg-blue-50 text-blue-700 border-blue-200/60',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200/60',
  shipped: 'bg-blue-50 text-blue-700 border-blue-200/60',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200/60',
}

interface RecentOrdersProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          <CardTitle className="text-base font-bold text-slate-800">{t('recentOrders')}</CardTitle>
          <CardDescription>{tCommon('noData')}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
        <Link
          href={`/${lang}/sales/orders`}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          {tCommon('all')} →
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {orders.map((order: any) => (
            <Link
              key={order.id}
              href={`/${lang}/sales/orders/${order.id}`}
              className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                  {order.customers?.name?.[0] ?? 'C'}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 group-hover:text-indigo-600 transition-colors">
                    {order.order_number}
                  </p>
                  <p className="text-xs text-muted-foreground">{order.customers?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] ?? 'bg-slate-50 text-slate-600 border-slate-200/60'
                  }`}
                >
                  {t(`status.${order.status}`)}
                </span>
                <span className="text-sm font-semibold text-slate-800">
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
