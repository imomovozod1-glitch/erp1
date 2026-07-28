'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
}

interface RecentOrdersProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orders: any[]
  lang: string
  title: string
}

export function RecentOrders({ orders, lang, title }: RecentOrdersProps) {
  const t = useTranslations('sales')
  const mockOrders = orders.length > 0 ? orders : [
    { id: '1', order_number: 'ORD-001', status: 'delivered', total_amount: 15000000, order_date: '2026-07-15', customers: { name: 'Alisher Karimov' } },
    { id: '2', order_number: 'ORD-002', status: 'confirmed', total_amount: 8500000, order_date: '2026-07-16', customers: { name: 'Zulfiya Rahimova' } },
    { id: '3', order_number: 'ORD-003', status: 'pending', total_amount: 22000000, order_date: '2026-07-17', customers: { name: 'Bobur Toshmatov' } },
    { id: '4', order_number: 'ORD-004', status: 'shipped', total_amount: 5750000, order_date: '2026-07-18', customers: { name: 'Malika Yusupova' } },
    { id: '5', order_number: 'ORD-005', status: 'draft', total_amount: 33000000, order_date: '2026-07-19', customers: { name: 'Jasur Nazarov' } },
  ]

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
        <Link
          href={`/${lang}/sales/orders`}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          View all →
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {mockOrders.map((order: any) => (
            <Link
              key={order.id}
              href={`/${lang}/sales/orders/${order.id}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
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
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${
                    STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] ?? 'bg-slate-100 text-slate-600'
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
