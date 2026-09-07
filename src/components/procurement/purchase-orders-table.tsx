'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { TableSearch, TablePagination } from '@/components/shared/table-pagination'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const STATUS_TONES: Record<string, StatusTone> = {
  draft: 'blue',
  sent: 'blue',
  received: 'emerald',
  partially_received: 'blue',
  cancelled: 'rose',
}

interface PurchaseOrdersTableProps {
  /** Only the current page's rows — the server applied search and paging. */
  orders: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function PurchaseOrdersTable({
  orders,
  lang,
  page,
  pageSize,
  total,
  totalPages,
}: PurchaseOrdersTableProps) {
  const t = useTranslations('procurement')
  const tCommon = useTranslations('common')
  const router = useRouter()



  // No client-side filtering or slicing: `orders` IS the current page.
  const paginated = orders

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
            <TableSearch />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
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
                      <StatusBadge tone={STATUS_TONES[order.status] ?? 'slate'} label={t(`status.${order.status}`)} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
      </CardContent>
    </Card>
    </>
  )
}
