'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { adjustCashboxBalance, applyCustomerCredit } from '@/lib/finance-helpers'
import { invalidateOrders, invalidateOrderItems, invalidateProducts, invalidateMovements, invalidateTransactions, invalidateInvoices, invalidateCustomers } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, ShoppingCart, Wallet, CreditCard, ArrowRightLeft, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface SaleFormProps {
  products: { id: string; name: string; price: number; cost_price: number; stock: number; unit: string; sku: string }[]
  customers: { id: string; name: string }[]
  lang: string
}

interface SaleItem {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  stock: number
  totalPrice: number
}

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'debt'

function generateOrderNumber() {
  return `SO-${Date.now().toString().slice(-8)}`
}

function generateInvoiceNumber() {
  return `INV-${Date.now().toString().slice(-8)}`
}

function getDueDateString(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

export function SaleForm({ products, customers, lang }: SaleFormProps) {
  const t = useTranslations('sales')
  const tCommon = useTranslations('common')
  const tPos = useTranslations('pos')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<SaleItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')

  // Temp selection
  const [selectedProductId, setSelectedProductId] = useState('')
  const [tempQty, setTempQty] = useState<number | ''>(1)

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId)
    const product = products.find(p => p.id === productId)
    if (product) {
      setTempQty(1)
    }
  }

  const addItem = () => {
    const qty = Number(tempQty) || 0
    if (!selectedProductId || qty <= 0) return
    const product = products.find(p => p.id === selectedProductId)
    if (!product) return

    if (qty > product.stock) {
      toast.error(`${t('availableStock')}: ${product.stock} ${product.unit}`)
      return
    }

    // Check if already added
    const existing = items.findIndex(i => i.productId === product.id)
    if (existing >= 0) {
      setItems(prev => prev.map((item, idx) => {
        if (idx === existing) {
          const newQty = item.quantity + qty
          return { ...item, quantity: newQty, totalPrice: newQty * item.unitPrice }
        }
        return item
      }))
    } else {
      setItems(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: qty,
        stock: product.stock,
        totalPrice: qty * product.price,
      }])
    }
    setSelectedProductId('')
    setTempQty(1)
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      toast.error(t('noItems'))
      return
    }

    const isDebtSale = paymentMethod === 'debt'
    if (isDebtSale && !customerId) {
      toast.error(lang === 'uz' ? 'Qarzga sotish uchun mijozni tanlang!' : lang === 'ru' ? 'Выберите клиента для продажи в долг!' : 'Select a customer for a debt sale!')
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient() as any
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const orderNumber = generateOrderNumber()
      const orderDateStr = getTodayString()

      // Create sales order
      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .insert([{
          order_number: orderNumber,
          customer_id: customerId || null,
          status: 'confirmed' as any,
          total_amount: totalAmount,
          created_by: user.id,
        } as any])
        .select()
        .single()

      if (orderError) throw orderError

      // Create sales order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
      }))

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(orderItems as any)

      if (itemsError) throw itemsError

      // Deduct stock and create stock movements
      for (const item of items) {
        const product = products.find(p => p.id === item.productId)
        if (!product) continue

        const quantityBefore = product.stock
        const quantityAfter = quantityBefore - item.quantity

        await supabase
          .from('products')
          .update({ stock: quantityAfter } as any)
          .eq('id', item.productId)

        await supabase
          .from('stock_movements')
          .insert([{
            product_id: item.productId,
            type: 'out' as any,
            quantity: item.quantity,
            quantity_before: quantityBefore,
            quantity_after: quantityAfter,
            reference_type: 'sales_order',
            reference_id: order.id,
            reason: `Sale ${orderNumber}`,
            created_by: user.id,
          } as any])
      }

      // If this is a debt sale and the customer already has credit (haqdorlik) on file,
      // spend it down against this purchase first — otherwise they'd show a credit
      // balance and a fresh debt at the same time for the same money.
      let appliedCredit = 0
      if (isDebtSale && customerId) {
        const result = await applyCustomerCredit(supabase, customerId, totalAmount)
        appliedCredit = result.appliedCredit
      }
      const debtFullyCoveredByCredit = isDebtSale && appliedCredit >= totalAmount

      // Always create an invoice — 'paid' immediately for cash/card/transfer,
      // 'sent' (unpaid) for debt sales so the customer's debt is tracked.
      const { error: invoiceError } = await supabase.from('invoices').insert({
        invoice_number: generateInvoiceNumber(),
        order_id: order.id,
        customer_id: customerId || null,
        status: isDebtSale ? (debtFullyCoveredByCredit ? 'paid' : 'sent') : 'paid',
        total_amount: totalAmount,
        paid_amount: isDebtSale ? appliedCredit : totalAmount,
        issued_at: orderDateStr,
        due_at: isDebtSale ? getDueDateString(14) : orderDateStr,
        paid_at: isDebtSale ? (debtFullyCoveredByCredit ? orderDateStr : null) : orderDateStr,
        notes: isDebtSale
          ? `Qarzga sotildi - Order #${orderNumber}${appliedCredit > 0 ? ` (${formatCurrency(appliedCredit)} haqdorlikdan to'landi)` : ''}`
          : `Paid via ${paymentMethod}`,
        created_by: user.id,
      })
      if (invoiceError) throw invoiceError

      // Only record cash-basis income when money actually changed hands — debt sales
      // create the income transaction later, when the debt is collected via the
      // cashbox's debt collection flow (avoids double-counting revenue).
      if (!isDebtSale) {
        const { error: txError } = await supabase.from('transactions').insert({
          type: 'income',
          amount: totalAmount,
          category: 'Sales',
          description: `Sale - Order #${orderNumber}`,
          reference_type: 'sales_orders',
          reference_id: order.id,
          transaction_date: orderDateStr,
          created_by: user.id,
        })
        if (txError) throw txError

        await adjustCashboxBalance(totalAmount, 'income', supabase, paymentMethod as 'cash' | 'card' | 'transfer')
      }

      await Promise.all([
        invalidateOrders(),
        invalidateOrderItems(),
        invalidateProducts(),
        invalidateMovements(),
        invalidateTransactions(),
        invalidateInvoices(),
        invalidateCustomers(),
      ])
      toast.success(t('saleCreated'))
      router.push(`/${lang}/sales/orders`)
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      {/* Customer Selection */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('customer')}</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="flex h-10 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">{tCommon('select')}</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tPos('paymentMethod')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl">
            {([
              { key: 'cash', label: tPos('cash'), icon: Wallet },
              { key: 'card', label: tPos('card'), icon: CreditCard },
              { key: 'transfer', label: tPos('transfer'), icon: ArrowRightLeft },
              { key: 'debt', label: tPos('debt'), icon: AlertTriangle },
            ] as const).map((pm) => {
              const isSelected = paymentMethod === pm.key
              return (
                <button
                  key={pm.key}
                  type="button"
                  onClick={() => setPaymentMethod(pm.key)}
                  className={`flex items-center justify-center gap-1.5 h-10 rounded-lg border text-xs font-semibold transition-all ${
                    isSelected
                      ? pm.key === 'debt'
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <pm.icon className="h-3.5 w-3.5" />
                  {pm.label}
                </button>
              )
            })}
          </div>
          {paymentMethod === 'debt' && !customerId && (
            <p className="text-xs text-amber-600 font-medium mt-2">
              {lang === 'uz' ? 'Qarzga sotish uchun mijozni tanlang' : lang === 'ru' ? 'Выберите клиента для продажи в долг' : 'Select a customer for a debt sale'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Product */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('addItem')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-50 space-y-1">
              <Label className="text-xs">{t('selectProduct')}</Label>
              <select
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{tCommon('select')}</option>
                {products.map(p => (
                  <option key={p.id} value={p.id} disabled={p.stock === 0}>
                    {p.name} — {formatCurrency(p.price)} ({t('availableStock')}: {p.stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">{t('quantity')}</Label>
              <NumericInput
                value={tempQty}
                onChange={(val) => setTempQty(val)}
                className="h-9"
              />
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-xs">{t('unitPrice')}</Label>
              <Input
                type="text"
                readOnly
                value={selectedProductId ? formatCurrency(products.find(p => p.id === selectedProductId)?.price ?? 0) : '—'}
                className="h-9 bg-slate-50"
              />
            </div>
            <Button
              type="button"
              onClick={addItem}
              size="sm"
              className="h-9 bg-indigo-600 hover:bg-indigo-500"
              disabled={!selectedProductId}
            >
              <Plus className="h-4 w-4 mr-1" /> {t('addItem')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      {items.length > 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>{t('productName')}</TableHead>
                  <TableHead className="text-right">{t('unitPrice')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead className="text-right">{t('totalPrice')}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.totalPrice)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-semibold">
                  <TableCell colSpan={3} className="text-right">{tCommon('total')}:</TableCell>
                  <TableCell className="text-right text-lg">{formatCurrency(totalAmount)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm border-dashed">
          <CardContent className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
            <ShoppingCart className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t('noItems')}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${lang}/sales/orders`)}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || items.length === 0 || (paymentMethod === 'debt' && !customerId)}
          className="bg-indigo-600 hover:bg-indigo-500"
        >
          {isSubmitting ? tCommon('loading') : tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
