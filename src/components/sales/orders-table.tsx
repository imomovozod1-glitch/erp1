'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ShoppingCart, MoreHorizontal, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { TableSearch, TablePagination } from '@/components/shared/table-pagination'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const STATUS_TONES: Record<string, StatusTone> = {
  draft: 'blue',
  pending: 'blue',
  confirmed: 'blue',
  shipped: 'blue',
  delivered: 'emerald',
  cancelled: 'rose',
}

interface OrdersTableProps {
  /** Only the current page's rows — the server applied search and paging. */
   
  orders: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function OrdersTable({
  orders,
  lang,
  page,
  pageSize,
  total,
  totalPages,
}: OrdersTableProps) {
  const t = useTranslations('sales')
  const tCommon = useTranslations('common')
  const router = useRouter()



  // No client-side filtering or slicing: `orders` IS the current page.
  const paginated = orders

  return (
    <>
      <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            <TableSearch />
          <span className="text-xs text-muted-foreground">{total} {tCommon('rows')}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-10 font-semibold text-center">#</TableHead>
              <TableHead>{t('orderNumber')}</TableHead>
              <TableHead>{t('customer')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('orderDate')}</TableHead>
              <TableHead className="text-right tabular-nums">{tCommon('total')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
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
                     onClick={() => router.push(`/${lang}/sales/orders/${order.id}`)}
                   >
                    <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                      {(page - 1) * pageSize + index + 1}
                    </TableCell>
                   <TableCell>
                     <code className="text-xs bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                       {order.order_number}
                     </code>
                   </TableCell>
                   <TableCell className="font-medium">{order.customers?.name ?? '—'}</TableCell>
                   <TableCell className="hidden md:table-cell text-muted-foreground">{formatDateTime(order.created_at)}</TableCell>
                   <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(order.total_amount)}</TableCell>
                   <TableCell>
                     <StatusBadge tone={STATUS_TONES[order.status] ?? 'slate'} label={t(`status.${order.status}`)} />
                   </TableCell>
                   <TableCell onClick={(e) => e.stopPropagation()}>
                     <DropdownMenu>
                       <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                         <MoreHorizontal className="h-4 w-4" />
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => router.push(`/${lang}/sales/orders/${order.id}/edit`)}>
                           <Pencil className="mr-2 h-3.5 w-3.5 text-slate-500" /> {tCommon('edit')}
                         </DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
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
