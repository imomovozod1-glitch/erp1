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
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-blue-50 text-blue-700 border-blue-200/60',
  pending: 'bg-blue-50 text-blue-700 border-blue-200/60',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200/60',
  shipped: 'bg-blue-50 text-blue-700 border-blue-200/60',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200/60',
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
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [search])

  const handleOpenDetails = async (order: any) => {
    setSelectedOrder(order)
    setIsLoadingItems(true)
    try {
      const supabase = createClient() as any
      const { data, error } = await supabase
        .from('sales_order_items')
        .select('*, products(name)')
        .eq('order_id', order.id)
      
      if (error) throw error
      setItems(data || [])
    } catch (err: any) {
      toast.error(err.message || 'Xatolik yuz berdi')
    } finally {
      setIsLoadingItems(false)
    }
  }

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
                 <TableRow key={order.id} className="hover:bg-slate-50/50">
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[order.status] ?? 'bg-slate-50 text-slate-600 border-slate-200/60'}`}>
                      {t(`status.${order.status}`)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDetails(order)}>
                          <Eye className="mr-2 h-3.5 w-3.5" /> {tCommon('view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/${lang}/sales/orders/${order.id}/edit`)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
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

    {/* Details Dialog */}
    <Dialog open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
      <DialogContent className="bg-white rounded-xl shadow-lg border border-slate-200 sm:max-w-xl w-full">
        <DialogHeader className="border-b pb-4 flex flex-row items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800">
              {selectedOrder?.order_number}
            </DialogTitle>
            <p className="text-xs text-slate-500 font-sans">
              {t('orders')}
            </p>
          </div>
        </DialogHeader>

        {selectedOrder && (
          <div className="space-y-6 pt-4">
            {/* Order Info Grid */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg text-sm">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {t('customer')}
                </span>
                <p className="font-semibold text-slate-800">{selectedOrder.customers?.name ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('orderDate')}
                </span>
                <p className="font-semibold text-slate-800">{formatDate(selectedOrder.order_date)}</p>
              </div>
              {selectedOrder.notes && (
                <div className="col-span-2 space-y-1 pt-2 border-t border-slate-200/60">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {tCommon('notes')}
                  </span>
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedOrder.notes}</p>
                </div>
              )}
            </div>

            {/* Items Section */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 text-sm">{t('items')}</h4>
              
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="h-9 py-1.5">{t('productName')}</TableHead>
                        <TableHead className="h-9 py-1.5 text-right">{t('quantity')}</TableHead>
                        <TableHead className="h-9 py-1.5 text-right">{t('unitPrice')}</TableHead>
                        <TableHead className="h-9 py-1.5 text-right">{t('totalPrice')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-slate-500 text-sm">
                            {tCommon('noData')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50">
                            <TableCell className="py-2.5 font-medium text-slate-800">
                              {item.products?.name ?? '—'}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-slate-700">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-slate-700">
                              {formatCurrency(item.unit_price)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-semibold text-slate-900">
                              {formatCurrency(item.total_price)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-slate-50 font-semibold border-t">
                        <TableCell colSpan={3} className="py-2.5 text-right text-slate-700">
                          {tCommon('total')}:
                        </TableCell>
                        <TableCell className="py-2.5 text-right text-indigo-700 text-base">
                          {formatCurrency(selectedOrder.total_amount)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
