'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'
import { invalidateSale } from '@/lib/data/revalidate'
import { createSaleRpc, SaleCreateError } from '@/lib/sale-create'
import { fireTelegramNotification } from '@/lib/integrations/notify-client'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { generateDocumentNumber, isoDate } from '@/lib/utils'
import { submitSaleInBrowser, type BrowserSale } from './sale-in-browser'
import {
  addProductLine,
  exceedsStock,
  removeLine,
  totalOf,
  updateLine,
  type PaymentMethod,
  type SaleItem,
  type SaleProduct,
} from './sale-lines'

const DEBT_TERM_DAYS = 14
const daysFromToday = (days: number) => isoDate(new Date(Date.now() + days * 86_400_000))

function buildSale(items: SaleItem[], customerId: string, paymentMethod: PaymentMethod, assignedTo: string | null): BrowserSale {
  const orderDateStr = isoDate()
  return {
    items,
    customerId,
    paymentMethod,
    assignedTo,
    totalAmount: totalOf(items),
    orderNumber: generateDocumentNumber('SO'),
    invoiceNumber: generateDocumentNumber('INV'),
    orderDateStr,
    dueDateStr: paymentMethod === 'debt' ? daysFromToday(DEBT_TERM_DAYS) : orderDateStr,
  }
}

async function saveSale(supabase: any, sale: BrowserSale) {
  const saved = await createSaleRpc(supabase, {
    channel: 'form',
    orderNumber: sale.orderNumber,
    invoiceNumber: sale.invoiceNumber,
    customerId: sale.customerId || null,
    paymentMethod: sale.paymentMethod,
    assignedTo: sale.assignedTo,
    totals: { total: sale.totalAmount },
    orderDate: sale.orderDateStr,
    dueDate: sale.dueDateStr,
    items: sale.items.map(({ productId, quantity, unitPrice, totalPrice }) => ({ productId, quantity, unitPrice, totalPrice })),
  })
  if (!saved) await submitSaleInBrowser(supabase, sale)
}

export function useSaleForm(products: SaleProduct[], customers: { id: string; name: string }[], lang: string) {
  const t = useTranslations()
  const exitForm = useRouteModalExit(`/${lang}/sales/orders`)
  const [items, setItems] = useState<SaleItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const stockLimit = (product: SaleProduct) => toast.error(`${t('sales.availableStock')}: ${product.stock} ${product.unit}`)
  const productOf = (item: SaleItem) => products.find((p) => p.id === item.productId)

  const addProduct = (product: SaleProduct) => {
    const next = addProductLine(items, product)
    if (!next) {
      stockLimit(product)
      return false
    }
    setItems(next)
  }

  const changeQuantity = (index: number, value: number | '') => {
    const quantity = Number(value) || 0
    const product = productOf(items[index])
    if (product && exceedsStock(product, quantity)) return stockLimit(product)
    setItems(updateLine(items, index, { quantity }))
  }

  const changePrice = (index: number, value: number | '') => setItems(updateLine(items, index, { unitPrice: Number(value) || 0 }))
  const remove = (index: number) => setItems(removeLine(items, index))

  const failure = (error: unknown) => {
    if (!(error instanceof SaleCreateError)) return errorMessage(t, error, t('common.error'))
    if (error.code === 'forbidden') return t('common.noPermission')
    if (error.code !== 'insufficient_stock') return t('pos.selectCustomerForDebt')
    const name = items.find((i) => i.productId === error.details.productId)?.productName ?? error.details.productName ?? ''
    return `${t('sales.availableStock')}: ${error.details.available ?? 0} — ${name}`
  }

  const notify = (sale: BrowserSale) =>
    fireTelegramNotification({
      event: 'sale',
      data: {
        orderNumber: sale.orderNumber,
        total: sale.totalAmount,
        paymentMethod: sale.paymentMethod,
        itemCount: sale.items.length,
        customerName: customers.find((c) => c.id === sale.customerId)?.name ?? null,
      },
    })

  const submit = async (e: React.SubmitEvent) => {
    e.preventDefault()
    if (!items.length) return void toast.error(t('sales.noItems'))
    if (paymentMethod === 'debt' && !customerId) return void toast.error(t('pos.selectCustomerForDebt'))
    setSubmitting(true)
    try {
      const sale = buildSale(items, customerId, paymentMethod, assignedTo)
      await saveSale(createClient(), sale)
      void invalidateSale().catch(() => {})
      notify(sale)
      toast.success(t('sales.saleCreated'))
      exitForm()
    } catch (error) {
      toast.error(failure(error))
    } finally {
      setSubmitting(false)
    }
  }

  return {
    items,
    total: totalOf(items),
    customerId,
    setCustomerId,
    paymentMethod,
    setPaymentMethod,
    assignedTo,
    setAssignedTo,
    submitting,
    productOf,
    addProduct,
    changeQuantity,
    changePrice,
    remove,
    submit,
    exitForm,
  }
}

export type SaleFormState = ReturnType<typeof useSaleForm>
