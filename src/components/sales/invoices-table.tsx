'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Search, MoreHorizontal, Pencil, FileText, Eye, Loader2, Calendar, ShoppingBag, Receipt, User, CheckCircle2 } from 'lucide-react'
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
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-500',
}

interface InvoicesTableProps {
  invoices: any[]
  lang: string
}

export function InvoicesTable({ invoices, lang }: InvoicesTableProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('sales')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [search])

  const handleAcceptPayment = async (invoice: any) => {
    setIsProcessingPayment(invoice.id)
    try {
      const supabase = createClient() as any
      const amountToPay = (Number(invoice.total_amount) || 0) - (Number(invoice.paid_amount) || 0)
      
      if (amountToPay <= 0) {
        toast.error("Ushbu invoys bo'yicha to'lanadigan qarz mavjud emas")
        return
      }

      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_amount: invoice.total_amount,
          paid_at: new Date().toISOString().split('T')[0]
        })
        .eq('id', invoice.id)

      if (error) throw error

      const { adjustCashboxBalance } = await import('@/lib/finance-helpers')
      await adjustCashboxBalance(amountToPay, 'income', supabase)

      toast.success(lang === 'uz' ? "To'lov muvaffaqiyatli qabul qilindi" : "Оплата успешно принята")
      
      setSelectedInvoice(null)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Xatolik yuz berdi')
    } finally {
      setIsProcessingPayment(null)
    }
  }

  const handleOpenDetails = async (invoice: any) => {
    setSelectedInvoice(invoice)
    if (!invoice.order_id) {
      setItems([])
      return
    }
    setIsLoadingItems(true)
    try {
      const supabase = createClient() as any
      const { data, error } = await supabase
        .from('sales_order_items')
        .select('*, products(name)')
        .eq('order_id', invoice.order_id)
      
      if (error) throw error
      setItems(data || [])
    } catch (err: any) {
      toast.error(err.message || 'Xatolik yuz berdi')
    } finally {
      setIsLoadingItems(false)
    }
  }

  const filtered = invoices.filter(
    (i) =>
      i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (i.customers?.name ?? '').toLowerCase().includes(search.toLowerCase())
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

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="w-10 text-center font-semibold text-slate-500">#</TableHead>
                <TableHead className="w-45">{t('invoiceNumber')}</TableHead>
                <TableHead>{t('customer')}</TableHead>
                <TableHead>{tCommon('status')}</TableHead>
                <TableHead className="text-right">{tCommon('total')}</TableHead>
                <TableHead className="text-right">{t('status.paid')}</TableHead>
                <TableHead className="text-right">{tCommon('date')}</TableHead>
                <TableHead className="w-17.5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    {tCommon('noData')}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((invoice, index) => (
                  <TableRow key={invoice.id} className="group">
                    <TableCell className="text-center font-medium text-slate-500 text-xs">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">
                            {invoice.invoice_number}
                          </div>
                          {invoice.sales_orders?.order_number && (
                            <div className="text-xs text-muted-foreground">
                              Ord: {invoice.sales_orders.order_number}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{invoice.customers?.name || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[invoice.status]}`}>
                          {t(`status.${invoice.status}`)}
                        </span>
                        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.customer_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/${lang}/finance/cashbox?action=kirim&type=debt_collection&customerId=${invoice.customer_id}`)}
                            className="h-7 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/70 hover:text-indigo-800 font-medium text-[10px] rounded-md transition-all px-2 mt-1"
                          >
                            To&apos;lov qilish
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total_amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(invoice.paid_amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(invoice.issued_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => handleOpenDetails(invoice)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {tCommon('view')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/${lang}/sales/invoices/${invoice.id}/edit`)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {tCommon('edit')}
                          </DropdownMenuItem>
                          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => handleAcceptPayment(invoice)}
                                disabled={isProcessingPayment === invoice.id}
                                className="text-emerald-600 focus:text-emerald-700"
                              >
                                {isProcessingPayment === invoice.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                )}
                                To&apos;lovni qabul qilish (Tezkor)
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => router.push(`/${lang}/finance/cashbox?action=kirim&type=debt_collection&customerId=${invoice.customer_id}`)}
                                className="text-indigo-600 focus:text-indigo-700 font-medium"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                To&apos;lov qilish (Kassa orqali)
                              </DropdownMenuItem>
                            </>
                          )}
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
      </div>
    </CardContent>
  </Card>

    {/* Details Dialog */}
    <Dialog open={selectedInvoice !== null} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
      <DialogContent className="bg-white rounded-xl shadow-lg border border-slate-200 sm:max-w-xl w-full">
        <DialogHeader className="border-b pb-4 flex flex-row items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800">
              {selectedInvoice?.invoice_number}
            </DialogTitle>
            <p className="text-xs text-slate-500 font-sans">
              {t('invoices')}
            </p>
          </div>
        </DialogHeader>

        {selectedInvoice && (
          <div className="space-y-6 pt-4">
            {/* Invoice Info Grid */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg text-sm">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {t('customer')}
                </span>
                <p className="font-semibold text-slate-800">{selectedInvoice.customers?.name ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {tCommon('date')}
                </span>
                <p className="font-semibold text-slate-800">{formatDate(selectedInvoice.issued_at)}</p>
              </div>
              {selectedInvoice.sales_orders?.order_number && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    {t('orderNumber')}
                  </span>
                  <p className="font-semibold text-slate-800">{selectedInvoice.sales_orders.order_number}</p>
                </div>
              )}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {tCommon('status')}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[selectedInvoice.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {t(`status.${selectedInvoice.status}`)}
                </span>
              </div>
              {selectedInvoice.notes && (
                <div className="col-span-2 space-y-1 pt-2 border-t border-slate-200/60">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {tCommon('notes')}
                  </span>
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedInvoice.notes}</p>
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
              ) : !selectedInvoice.order_id ? (
                <div className="text-center py-6 text-slate-500 text-sm border rounded-lg">
                  {tCommon('noData')}
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
                          {formatCurrency(selectedInvoice.total_amount)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
              {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button 
                    onClick={() => handleAcceptPayment(selectedInvoice)}
                    disabled={isProcessingPayment === selectedInvoice.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium"
                  >
                    {isProcessingPayment === selectedInvoice.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    To&apos;lovni qabul qilish
                  </Button>
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
