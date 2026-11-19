'use client'

import type { ReactNode } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-violet-600" />
    </div>
  )
}

export function DocumentInfoCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm md:col-span-1">
      <CardHeader className="flex flex-row items-center gap-3 border-b bg-muted/40 p-5">
        <span className="rounded-xl bg-brand-subtle p-2 text-violet-600 dark:text-violet-400">
          <Icon className="size-5" />
        </span>
        <CardTitle className="text-sm font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">{children}</CardContent>
    </Card>
  )
}

export function InfoItem({ icon: Icon, label, children }: { icon?: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </span>
      <div className="font-semibold text-foreground">{children}</div>
    </div>
  )
}

export interface SaleItemRow {
  id: string
  quantity: number
  unit_price: number
  total_price: number
  products?: { name?: string } | null
}

export function SaleItemsCard({ items, emptyLabel }: { items: SaleItemRow[]; emptyLabel?: string }) {
  const t = useTranslations('sales')
  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm md:col-span-2">
      <CardHeader className="border-b bg-muted/40 p-5">
        <CardTitle className="text-sm font-bold">{t('items')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!items.length && emptyLabel ? (
          <p className="p-12 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <>
            <ul className="divide-y md:hidden">
              {items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium break-words text-foreground">{item.products?.name ?? '—'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-bold text-foreground tabular-nums">{formatCurrency(item.total_price)}</p>
                </li>
              ))}
            </ul>
            <Table containerClassName="max-md:hidden">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="h-10 font-bold">{t('productName')}</TableHead>
                  <TableHead className="h-10 text-right font-bold">{t('quantity')}</TableHead>
                  <TableHead className="h-10 text-right font-bold">{t('unitPrice')}</TableHead>
                  <TableHead className="h-10 text-right font-bold">{t('totalPrice')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.products?.name ?? '—'}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(item.total_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
