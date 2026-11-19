'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { invalidateSale } from '@/lib/data/revalidate'
import { errorMessage } from '@/lib/error-message'
import { fireTelegramNotification } from '@/lib/integrations/notify-client'
import { printReceiptDirect } from '@/lib/printer/print'
import { createClient } from '@/lib/supabase/client'
import { generateDocumentNumber } from '@/lib/utils'
import { PosSaleError, submitPosSale, type PosPaymentMethod, type PosSaleResult } from '@/components/pos/checkout'
import { lowStockAlerts, receiptOf, shiftStock, stockFromDatabase, type SaleTotals } from '@/components/pos/pos-sale-model'
import type { ReceiptOrder } from '@/components/pos/pos-receipt-dialog'
import type { CartItem, PosCart } from '@/components/pos/use-pos-cart'
import type { PosCatalogue } from '@/components/pos/use-pos-catalogue'

export type SaleStatus = 'saving' | 'saved' | 'failed'

interface CheckoutDeps {
  cart: PosCart
  catalogue: PosCatalogue
  customer: any | null
  paymentMethod: PosPaymentMethod
  cashierName: string
  company: { name: string; phone?: string }
  clearTill: () => void
}

interface RungSale {
  orderNumber: string
  items: CartItem[]
  totals: SaleTotals
  customer: any | null
  method: PosPaymentMethod
}

// Never awaited and never throws: the sale is committed, so a Telegram outage must not turn it into an error.
function notifySale(sale: RungSale, result: PosSaleResult) {
  fireTelegramNotification({
    event: 'sale',
    data: { orderNumber: sale.orderNumber, total: sale.totals.total, paymentMethod: sale.method, itemCount: sale.items.length, customerName: sale.customer?.name ?? null },
  })
  for (const alert of lowStockAlerts(sale.items, result.stockBefore)) fireTelegramNotification({ event: 'low_stock', data: alert })
}

/**
 * Rings up the sale. The receipt appears on the click — everything printed on it is known
 * before a row is written — and the sale is committed in the background, the receipt
 * carrying `saving` / `failed`, because the cashier has taken the money by then.
 */
export function usePosCheckout({ cart, catalogue, customer, paymentMethod, cashierName, company, clearTill }: CheckoutDeps) {
  const t = useTranslations()
  const [receipt, setReceipt] = useState<ReceiptOrder | null>(null)
  const [status, setStatus] = useState<SaleStatus>('saved')

  const messages = {
    sessionNotFound: t('common.sessionNotFound'),
    insufficientStock: t('pos.insufficientStock'),
    forbidden: t('common.noPermission'),
    customerRequired: t('pos.selectCustomerForDebt'),
  }

  const commit = async (sale: RungSale) => {
    try {
      const result = await submitPosSale({ supabase: createClient(), orderNumber: sale.orderNumber, items: sale.items, customer: sale.customer, paymentMethod: sale.method, totals: sale.totals, messages })
      setStatus('saved')
      toast.success(t('pos.orderSuccess'))
      catalogue.setProducts((current) => stockFromDatabase(current, sale.items, result.stockBefore))
      notifySale(sale, result)
      void invalidateSale().catch(() => {})
    } catch (error) {
      setStatus('failed')
      toast.error(error instanceof PosSaleError ? error.message : errorMessage(t, error, t('common.error')))
      catalogue.setProducts((current) => shiftStock(current, sale.items, 1))
    }
  }

  const checkout = () => {
    if (cart.items.length === 0) return void toast.error(t('pos.emptyCart'))
    if (paymentMethod === 'debt' && !customer) return void toast.error(t('pos.selectCustomerForDebt'))
    const sale: RungSale = {
      orderNumber: generateDocumentNumber('SO-POS'),
      items: cart.items,
      totals: { subtotal: cart.subtotal, discount: cart.discount, tax: cart.tax, total: cart.total },
      customer,
      method: paymentMethod,
    }
    setReceipt(receiptOf({ ...sale, cashier: cashierName, customerName: customer?.name ?? t('pos.walkInCustomer'), paymentMethod: sale.method }))
    setStatus('saving')
    catalogue.setProducts(shiftStock(catalogue.products, sale.items, -1))
    clearTill()
    void commit(sale)
  }

  // Straight to the paired ESC/POS printer when there is one; the browser's Print dialog otherwise.
  const print = async () => {
    if (receipt) {
      const labels = {
        receipt: t('pos.receipt'), date: t('common.date'), cashier: t('pos.cashier'), customer: t('pos.customer'),
        subtotal: t('pos.subtotal'), discount: t('pos.discount'), tax: t('pos.tax'), total: t('pos.total'),
        paymentMethod: t('pos.paymentMethod'), thankYou: t('pos.thankYou'),
      }
      const result = await printReceiptDirect(receipt, company, labels)
      if (result.ok) return void toast.success(t('pos.printedDirectly'))
    }
    window.print()
  }

  return { receipt, status, checkout, print, closeReceipt: () => setReceipt(null) }
}
