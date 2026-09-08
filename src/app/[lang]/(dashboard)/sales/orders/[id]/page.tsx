'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { 
  ShoppingBag, 
  User, 
  Calendar, 
  FileText, 
  ArrowLeft, 
  Pencil,
  Loader2 
} from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'

// sales_orders.notes is free-form text; the only system-generated template written
// to it (pos-client.tsx) is "POS Sale - Paid via CASH/CARD/TRANSFER/DEBT" — translate
// that known template, same approach as translateReason on the product detail page.
// Anything else is either null or text the user typed themselves, so it passes through.
function translateOrderNotes(notes: string | null | undefined, lang: string): string {
  if (!notes) return ''
  const posMatch = notes.match(/^POS Sale - Paid via (CASH|CARD|TRANSFER|DEBT)$/)
  if (posMatch) {
    const methodLabels: Record<string, { uz: string; ru: string }> = {
      CASH: { uz: 'Naqd pul', ru: 'Наличные' },
      CARD: { uz: 'Karta', ru: 'Карта' },
      TRANSFER: { uz: "O'tkazma", ru: 'Перевод' },
      DEBT: { uz: 'Qarz', ru: 'Долг' },
    }
    const method = methodLabels[posMatch[1]]
    return lang === 'uz'
      ? `POS sotuvi - to'lov usuli: ${method.uz}`
      : `Продажа через POS - способ оплаты: ${method.ru}`
  }
  return notes
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  pending: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/50',
  confirmed: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/50',
  shipped: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border-violet-200/60 dark:border-violet-900/50',
  delivered: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/50',
  cancelled: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/50',
}

export default function OrderDetailPage() {
  const params = useParams() as any
  const router = useRouter()
  const lang = params.lang
  const id = params.id

  const t = useTranslations('sales')
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
          .from('sales_orders')
          .select('*, customers(name)')
          .eq('id', id)
          .single()

        if (orderErr) throw orderErr

        const { data: itemsData, error: itemsErr } = await supabase
          .from('sales_order_items')
          .select('*, products(name)')
          .eq('order_id', id)

        if (itemsErr) throw itemsErr

        setOrder(orderData)
        setItems(itemsData || [])
      } catch (err: any) {
        toast.error(err.message || tCommon('error'))
        router.push(`/${lang}/sales/orders`)
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
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    )
  }

  if (!order) return null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${t('orders')}: ${order.order_number}`}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('orders'), href: `/${lang}/sales/orders` },
          { label: order.order_number }
        ]}
      />

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.push(`/${lang}/sales/orders`)}
          className="w-full md:w-auto h-9 gap-2 text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('back')}
        </Button>
        <Button
          onClick={() => router.push(`/${lang}/sales/orders/${order.id}/edit`)}
          className="w-full md:w-auto h-9 gap-2 text-xs bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Pencil className="h-4 w-4" />
          {tCommon('edit')}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column - Info card */}
        <Card className="md:col-span-1 border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="p-2 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-xl">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('orderInfo')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {t('customer')}
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{order.customers?.name ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {t('orderDate')}
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDateTime(order.created_at)}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {tCommon('status')}
              </span>
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[order.status] ?? 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                  {t(`status.${order.status}`)}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {tCommon('totalAmount')}
              </span>
              <p className="text-lg font-black text-violet-600 dark:text-violet-400">{formatCurrency(order.total_amount)}</p>
            </div>
            {order.notes && (
              <div className="space-y-1 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {tCommon('notes')}
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{translateOrderNotes(order.notes, lang)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column - Items list */}
        <Card className="md:col-span-2 border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('items')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/30 dark:bg-slate-800/30">
                    <TableHead className="font-bold text-slate-400 dark:text-slate-500 h-10">{t('productName')}</TableHead>
                    <TableHead className="font-bold text-slate-400 dark:text-slate-500 h-10 text-right">{t('quantity')}</TableHead>
                    <TableHead className="font-bold text-slate-400 dark:text-slate-500 h-10 text-right">{t('unitPrice')}</TableHead>
                    <TableHead className="font-bold text-slate-400 dark:text-slate-500 h-10 text-right">{t('totalPrice')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40">
                      <TableCell className="font-medium text-slate-800 dark:text-slate-200">{item.products?.name ?? '—'}</TableCell>
                      <TableCell className="text-right text-slate-700 dark:text-slate-300">{item.quantity}</TableCell>
                      <TableCell className="text-right text-slate-700 dark:text-slate-300">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-bold text-slate-900 dark:text-slate-100">{formatCurrency(item.total_price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
