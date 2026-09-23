'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ShoppingCart, MoreHorizontal, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CancelPurchaseDialog, type CancelablePurchase } from '@/components/procurement/cancel-purchase-dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableSearch, TablePagination, useUrlState } from '@/components/shared/table-pagination'
import { PeriodFilter, type Period } from '@/components/shared/period-filter'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { purchaseStatusTone } from '@/lib/statuses'

interface PurchaseOrdersTableProps {
  /** Only the current page's rows — the server applied search, period and paging. */
  orders: any[]
  /** Active period key; the range itself is resolved server-side. */
  period: Period
  customStart: string
  customEnd: string
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function PurchaseOrdersTable({
  orders,
  period,
  customStart,
  customEnd,
  lang,
  page,
  pageSize,
  total,
  totalPages,
}: PurchaseOrdersTableProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('procurement')
  const router = useRouter()
  const { setParams } = useUrlState()
  const [cancelling, setCancelling] = useState<CancelablePurchase | null>(null)



  // No client-side filtering or slicing: `orders` IS the current page.
  const paginated = orders

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
            <div className="flex flex-wrap items-center gap-3">
              <TableSearch />
              {/* Server-side like the search beside it: changing the period
                  rewrites the query string and Postgres does the filtering. */}
              <PeriodFilter
                period={period}
                onPeriodChange={(next) =>
                  setParams({ period: next === 'all' ? null : next, page: null, from: null, to: null })
                }
                customStart={customStart}
                customEnd={customEnd}
                onApplyCustomRange={(start, end) =>
                  setParams({ period: 'custom', from: start || null, to: end || null, page: null })
                }
                lang={lang}
              />
            </div>
            <span className="text-xs text-muted-foreground">{total} {tCommon('rows')}</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableHead className="w-10 font-semibold text-center">#</TableHead>
                <TableHead>{t('poNumber')}</TableHead>
                <TableHead>{t('supplier')}</TableHead>
                <TableHead className="hidden md:table-cell">{tCommon('date')}</TableHead>
                <TableHead className="text-right tabular-nums">{tCommon('total')}</TableHead>
                <TableHead className="hidden lg:table-cell">{tCommon('assignedTo')}</TableHead>
                <TableHead className="hidden xl:table-cell">{tCommon('createdBy')}</TableHead>
                <TableHead>{tCommon('status')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 opacity-40" />
                      <p className="text-sm">{tCommon('noData')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((order, index) => (
                  <TableRow 
                    key={order.id} 
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    onClick={() => router.push(`/${lang}/procurement/purchase-orders/${order.id}`)}
                  >
                    <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                      {(page - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                        {order.po_number}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800 dark:text-slate-200">{order.suppliers?.name ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{formatDateTime(order.created_at)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(order.total_amount)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {order.assignee?.full_name || tCommon('unassigned')}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground">
                        {order.creator?.full_name || '—'}
                      </TableCell>
                    <TableCell>
                      <StatusBadge tone={purchaseStatusTone(order.status)} label={t(`status.${order.status}`)} />
                    </TableCell>
                    <TableCell className="w-12">
                      {order.status !== 'cancelled' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                // The row navigates on click; the menu must not
                                // also open the purchase behind it.
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              />
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                setCancelling({ id: order.id, po_number: order.po_number, status: order.status })
                              }}
                              className="text-rose-600 focus:text-rose-600 dark:text-rose-400"
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              {t('cancel.action')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
      </CardContent>
    </Card>

    <CancelPurchaseDialog
      purchase={cancelling}
      open={cancelling !== null}
      onOpenChange={(open) => !open && setCancelling(null)}
    />
    </>
  )
}
