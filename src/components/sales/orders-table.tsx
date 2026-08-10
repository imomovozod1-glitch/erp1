'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Search, ShoppingCart, MoreHorizontal, Pencil, Eye, Loader2, Calendar, FileText, ShoppingBag, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const STATUS_TONES: Record<string, StatusTone> = {
  draft: 'blue',
  pending: 'blue',
  confirmed: 'blue',
  shipped: 'blue',
  delivered: 'emerald',
  cancelled: 'rose',
}

interface OrdersTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orders: any[]
  lang: string
}

export function OrdersTable({ orders, lang }: OrdersTableProps) {
  const t = useTranslations('sales')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [search])

  const filtered = orders.filter(
    (o) =>
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.customers?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <>
      <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${tCommon('search')}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} {tCommon('rows')}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-10 font-semibold text-center">#</TableHead>
              <TableHead>{t('orderNumber')}</TableHead>
              <TableHead>{t('customer')}</TableHead>
              <TableHead>{t('orderDate')}</TableHead>
              <TableHead className="text-right">{tCommon('total')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
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
                     className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                     onClick={() => router.push(`/${lang}/sales/orders/${order.id}`)}
                   >
                    <TableCell className="text-center font-medium text-slate-500 text-xs">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableCell>
                   <TableCell>
                     <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono font-semibold">
                       {order.order_number}
                     </code>
                   </TableCell>
                   <TableCell className="font-medium">{order.customers?.name ?? '—'}</TableCell>
                   <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                   <TableCell className="text-right font-semibold">{formatCurrency(order.total_amount)}</TableCell>
                   <TableCell>
                     <StatusBadge tone={STATUS_TONES[order.status] ?? 'slate'} label={t(`status.${order.status}`)} />
                   </TableCell>
                   <TableCell onClick={(e) => e.stopPropagation()}>
                     <DropdownMenu>
                       <DropdownMenuTrigger>
                         <Button variant="ghost" size="icon" className="h-8 w-8">
                           <MoreHorizontal className="h-4 w-4" />
                         </Button>
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="cursor-pointer"
            >
              {lang === 'uz' ? 'Orqaga' : lang === 'ru' ? 'Назад' : 'Previous'}
            </Button>
            <span className="text-xs text-muted-foreground font-medium">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="cursor-pointer"
            >
              {lang === 'uz' ? 'Oldinga' : lang === 'ru' ? 'Вперед' : 'Next'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  )
}
