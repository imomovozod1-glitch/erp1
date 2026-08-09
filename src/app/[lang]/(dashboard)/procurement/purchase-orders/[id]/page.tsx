'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { PageClock } from '@/components/shared/page-clock'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { 
  Receipt, 
  Truck, 
  Calendar, 
  FileText, 
  ArrowLeft, 
  Loader2 
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  ordered: 'bg-blue-50 text-blue-700 border-blue-200/50',
  received: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200/50',
}

export default function PurchaseOrderDetailPage() {
  const params = useParams() as any
  const router = useRouter()
  const lang = params.lang
  const id = params.id

  const t = useTranslations('procurement')
  const tCommon = useTranslations('common')

  const [order, setOrder] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchOrderDetails() {
      setIsLoading(true)
      try {
        const supabase = createClient() as any
        const { data: orderData, error: orderErr } = await supabase
          .from('purchase_orders')
          .select('*, suppliers(name)')
          .eq('id', id)
          .single()

        if (orderErr) throw orderErr

        const { data: itemsData, error: itemsErr } = await supabase
          .from('purchase_order_items')
          .select('*, products(name)')
          .eq('po_id', id)

        if (itemsErr) throw itemsErr

        setOrder(orderData)
        setItems(itemsData || [])
      } catch (err: any) {
        toast.error(err.message || tCommon('error'))
        router.push(`/${lang}/procurement/purchase-orders`)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchOrderDetails()
    }
  }, [id, lang, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!order) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 pt-6 max-w-5xl mx-auto">
      <PageHeader
        title={`${t('purchaseOrders')}: ${order.po_number}`}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('purchaseOrders'), href: `/${lang}/procurement/purchase-orders` },
          { label: order.po_number }
        ]}
      >
        <PageClock lang={lang} />
      </PageHeader>

      <div>
        <Button
          variant="outline"
          onClick={() => router.push(`/${lang}/procurement/purchase-orders`)}
          className="w-full md:w-auto h-9 gap-2 text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('back')}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column - Info card */}
        <Card className="md:col-span-1 border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center gap-3 bg-slate-50/50">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-800">{lang === 'uz' ? 'Xarid buyurtmasi ma\'lumotlari' : 'Информация о заказе закупки'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" />
                {t('supplier')}
              </span>
              <p className="font-semibold text-slate-805">{order.suppliers?.name ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {tCommon('date')}
              </span>
              <p className="font-semibold text-slate-805">{formatDate(order.order_date)}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {tCommon('status')}
              </span>
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[order.status] ?? 'bg-slate-50 text-slate-650'}`}>
                  {t(`status.${order.status}`)}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {lang === 'uz' ? 'Jami summa' : 'Итоговая сумма'}
              </span>
              <p className="text-lg font-black text-indigo-600">{formatCurrency(order.total_amount)}</p>
            </div>
            {order.notes && (
              <div className="space-y-1 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {tCommon('notes')}
                </span>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column - Items list */}
        <Card className="md:col-span-2 border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-800">{t('product')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/30">
                    <TableHead className="font-bold text-slate-400 h-10">{t('product')}</TableHead>
                    <TableHead className="font-bold text-slate-400 h-10 text-right">{t('quantity')}</TableHead>
                    <TableHead className="font-bold text-slate-400 h-10 text-right">{t('unitCost')}</TableHead>
                    <TableHead className="font-bold text-slate-400 h-10 text-right">{t('totalCost')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/40">
                      <TableCell className="font-medium text-slate-800">{item.products?.name ?? '—'}</TableCell>
                      <TableCell className="text-right text-slate-700">{item.quantity}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatCurrency(item.unit_cost)}</TableCell>
                      <TableCell className="text-right font-bold text-slate-900">{formatCurrency(item.total_cost)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-semibold border-t">
                    <TableCell colSpan={3} className="text-right text-slate-700">
                      {tCommon('total')}:
                    </TableCell>
                    <TableCell className="text-right text-indigo-700 text-base">
                      {formatCurrency(order.total_amount)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
