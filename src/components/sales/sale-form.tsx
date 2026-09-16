'use client'

import { useState } from 'react'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { adjustCashboxBalance, applyCustomerCredit } from '@/lib/finance-helpers'
import { consumeCostLayers, getEffectiveCostingMethod } from '@/lib/inventory-costing'
import { invalidateSale } from '@/lib/data/revalidate'
import { createSaleRpc, SaleCreateError } from '@/lib/sale-create'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, ShoppingCart, Wallet, CreditCard, ArrowRightLeft, AlertTriangle } from 'lucide-react'
import { formatCurrency, generateDocumentNumber, isoDate } from '@/lib/utils'
import { unitAllowsDecimals } from '@/lib/units'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { fireTelegramNotification } from '@/lib/integrations/notify-client'

interface SaleFormProps {
  products: { id: string; name: string; price: number; cost_price: number; stock: number; unit: string; sku: string }[]
  customers: { id: string; name: string }[]
  /** Active tenant members who can be made responsible for the sale. */
  assignableUsers: AssignableUser[]
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
  return generateDocumentNumber('SO')
}

function generateInvoiceNumber() {
  return generateDocumentNumber('INV')
}

function getDueDateString(daysFromNow: number): string {
  return isoDate(new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000))
}

function getTodayString(): string {
  return isoDate()
}

/**
 * Pre-migration fallback for the sale form: the same sale as separate browser
 * writes. Remove once migration_business_rpc.sql is applied everywhere.
 */
async function submitSaleInBrowser(
  supabase: any,
  {
    items,
    customerId,
    paymentMethod,
    assignedTo,
    totalAmount,
    orderNumber,
    invoiceNumber,
    orderDateStr,
    dueDateStr,
    availableStockLabel,
  }: {
    items: SaleItem[]
    customerId: string
    paymentMethod: PaymentMethod
    assignedTo: string | null
    totalAmount: number
    orderNumber: string
    invoiceNumber: string
    orderDateStr: string
    dueDateStr: string
    availableStockLabel: string
  }
): Promise<void> {
  const isDebtSale = paymentMethod === 'debt'
  // getSession() reads the JWT already in memory; getUser() spends a network
  // round trip re-validating it before a single row is written, and buys
  // nothing — the id below only stamps created_by/assigned_to, and the
  // database validates the caller from the same token regardless. The POS
  // checkout made this trade already; this form had not.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) throw new Error('Not authenticated')

  // Current stock and the costing method: neither depends on the other, so
  // they travel together. Stock is re-read immediately before writing
  // because `products` is a snapshot from page load — deducting from it
  // wrote back a stale figure and silently reverted anything sold or
  // received in between.
  const [{ data: freshProducts, error: freshErr }, { data: tenant }] = await Promise.all([
    supabase
      .from('products')
      .select('id, stock, name')
      .in('id', items.map((i) => i.productId)),
    supabase.from('tenants').select('costing_method').limit(1).single(),
  ])
  if (freshErr) throw freshErr

  const stockById = new Map<string, number>((freshProducts || []).map((p: any) => [p.id, Number(p.stock)]))
  // Lines are validated against the TOTAL a product is sold in this order —
  // the same product may appear on two lines, and checking each line alone
  // let their sum exceed what is on the shelf.
  const quantityByProduct = new Map<string, number>()
  for (const item of items) {
    quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity)
  }
  for (const [productId, quantity] of quantityByProduct) {
    const currentStock = stockById.get(productId)
    if (currentStock === undefined || currentStock < quantity) {
      const name = items.find((i) => i.productId === productId)?.productName ?? ''
      throw new Error(`${availableStockLabel}: ${currentStock ?? 0} — ${name}`)
    }
  }

  // Create sales order
  const { data: order, error: orderError } = await supabase
    .from('sales_orders')
    .insert([{
      order_number: orderNumber,
      customer_id: customerId || null,
      status: 'confirmed' as any,
      total_amount: totalAmount,
      created_by: user.id,
      // Responsible person, defaulting to whoever made the sale.
      assigned_to: assignedTo ?? user.id,
    } as any])
    .select()
    .single()

  if (orderError) throw orderError

  // Cost every line at whatever FIFO/LIFO/AVECO charges right now, before
  // stock is deducted, so the realised cost can be stored on the order item
  // and the movement.
  //
  // Consumed once per PRODUCT rather than once per line: the layers are
  // shared, so two lines of the same product must not walk them twice, and
  // grouping is what makes the calls independent enough to run at once.
  // This loop used to await one round trip per line, three deep.
  const method = getEffectiveCostingMethod(tenant)
  const productIds = [...quantityByProduct.keys()]
  const consumed = await Promise.all(
    productIds.map((productId) =>
      consumeCostLayers(supabase, productId, quantityByProduct.get(productId) as number, method)
    )
  )
  const costByProductId = new Map<string, { unitCost: number; totalCost: number }>(
    productIds.map((productId, i) => [productId, consumed[i]])
  )

  // Create sales order items
  const orderItems = items.map(item => ({
    order_id: order.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    unit_cost: costByProductId.get(item.productId)?.unitCost ?? null,
    total_price: item.totalPrice,
  }))

  // Stock and movements, worked out in memory first so the writes can all
  // go at once. One UPDATE per product (two parallel updates of the same row
  // would race and one would be lost) and one movement per line, each with
  // its own before/after so a product listed twice reads correctly.
  const movementRows: any[] = []
  const finalStockByProduct = new Map<string, number>()
  for (const item of items) {
    const quantityBefore = finalStockByProduct.get(item.productId) ?? stockById.get(item.productId)
    if (quantityBefore === undefined) continue
    const quantityAfter = quantityBefore - item.quantity
    finalStockByProduct.set(item.productId, quantityAfter)
    const cost = costByProductId.get(item.productId)
    movementRows.push({
      product_id: item.productId,
      type: 'out' as any,
      quantity: item.quantity,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      reference_type: 'sales_orders',
      reference_id: order.id,
      reason: `Sale ${orderNumber}`,
      unit_cost: cost?.unitCost ?? null,
      total_cost: cost ? cost.unitCost * item.quantity : null,
      created_by: user.id,
    })
  }

  const [{ error: itemsError }, { error: movementsError }] = await Promise.all([
    supabase.from('sales_order_items').insert(orderItems as any),
    supabase.from('stock_movements').insert(movementRows as any),
    ...[...finalStockByProduct].map(([productId, stock]) =>
      supabase
        .from('products')
        .update({ stock } as any)
        .eq('id', productId)
        .then(({ error }: any) => {
          if (error) throw error
        })
    ),
  ])
  if (itemsError) throw itemsError
  if (movementsError) throw movementsError

  // If this is a debt sale and the customer already has credit (haqdorlik) on file,
  // spend it down against this purchase first — otherwise they'd show a credit
  // balance and a fresh debt at the same time for the same money.
  let appliedCredit = 0
  if (isDebtSale && customerId) {
    const result = await applyCustomerCredit(supabase, customerId, totalAmount)
    appliedCredit = result.appliedCredit
  }
  const debtFullyCoveredByCredit = isDebtSale && appliedCredit >= totalAmount

  // The invoice, the income transaction and the cashbox all hang off the
  // order that already exists — none of them depends on another, so they
  // go together rather than one round trip at a time.
  const isCashSale = !isDebtSale
  const [{ error: invoiceError }] = await Promise.all([
    // Always create an invoice — 'paid' immediately for cash/card/transfer,
    // 'sent' (unpaid) for debt sales so the customer's debt is tracked.
    supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      order_id: order.id,
      customer_id: customerId || null,
      status: isDebtSale ? (debtFullyCoveredByCredit ? 'paid' : 'sent') : 'paid',
      total_amount: totalAmount,
      paid_amount: isDebtSale ? appliedCredit : totalAmount,
      issued_at: orderDateStr,
      due_at: dueDateStr,
      paid_at: isDebtSale ? (debtFullyCoveredByCredit ? orderDateStr : null) : orderDateStr,
      notes: isDebtSale
        ? `Qarzga sotildi - Order #${orderNumber}${appliedCredit > 0 ? ` (${formatCurrency(appliedCredit)} haqdorlikdan to'landi)` : ''}`
        : `Paid via ${paymentMethod}`,
      created_by: user.id,
      assigned_to: assignedTo ?? user.id,
    }),
    // Only record cash-basis income when money actually changed hands — a
    // debt sale creates its income transaction later, when the debt is
    // collected through the cashbox, or the revenue is counted twice.
    isCashSale
      ? supabase
          .from('transactions')
          .insert({
            type: 'income',
            amount: totalAmount,
            category: 'Sales',
            description: `Sale - Order #${orderNumber}`,
            reference_type: 'sales_orders',
            reference_id: order.id,
            transaction_date: orderDateStr,
            created_by: user.id,
          })
          .then(({ error }: any) => {
            if (error) throw error
          })
      : Promise.resolve(),
    isCashSale
      ? adjustCashboxBalance(totalAmount, 'income', supabase, paymentMethod as 'cash' | 'card' | 'transfer')
      : Promise.resolve(),
  ])
  if (invoiceError) throw invoiceError
}

export function SaleForm({ products, customers, assignableUsers, lang }: SaleFormProps) {
  const tCommon = useTranslations('common')
  const tPos = useTranslations('pos')
  const t = useTranslations('sales')
  const exitForm = useRouteModalExit(`/${lang}/sales/orders`)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<SaleItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [assignedTo, setAssignedTo] = useState<string | null>(null)

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

  const handleSubmit = async (e: React.SubmitEvent) => {
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
      const orderNumber = generateOrderNumber()
      const invoiceNumber = generateInvoiceNumber()
      const orderDateStr = getTodayString()
      const dueDateStr = isDebtSale ? getDueDateString(14) : orderDateStr

      // One request: `create_sale` writes the whole sale in a single
      // transaction (src/lib/sale-create.ts). `null` means the migration is not
      // applied yet, and the old browser-side path does it instead.
      const saved = await createSaleRpc(supabase, {
        channel: 'form',
        orderNumber,
        invoiceNumber,
        customerId: customerId || null,
        paymentMethod,
        assignedTo,
        totals: { total: totalAmount },
        orderDate: orderDateStr,
        dueDate: dueDateStr,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      })
      if (!saved) {
        await submitSaleInBrowser(supabase, {
          items,
          customerId,
          paymentMethod,
          assignedTo,
          totalAmount,
          orderNumber,
          invoiceNumber,
          orderDateStr,
          dueDateStr,
          availableStockLabel: t('availableStock'),
        })
      }

      // Cache invalidation is for *other* pages on their next visit; nothing
      // here waits for it, so it must not hold the form open.
      void invalidateSale().catch(() => {
        // A failed revalidation only means another page may show stale numbers
        // until its cache window lapses; the sale itself is already saved.
      })
      // Telegram notification (Settings → Integrations). Fire-and-forget: the
      // sale is already committed, so a Telegram failure must not surface here.
      fireTelegramNotification({
        event: 'sale',
        data: {
          orderNumber,
          total: totalAmount,
          paymentMethod,
          itemCount: items.length,
          customerName: customers.find((c) => c.id === customerId)?.name ?? null,
        },
      })

      toast.success(t('saleCreated'))
      exitForm()
    } catch (error: any) {
      if (error instanceof SaleCreateError) {
        if (error.code === 'insufficient_stock') {
          const name =
            items.find((item) => item.productId === error.details.productId)?.productName ??
            error.details.productName ??
            ''
          toast.error(`${t('availableStock')}: ${error.details.available ?? 0} — ${name}`)
        } else {
          toast.error(error.code === 'forbidden' ? tCommon('noPermission') : tPos('selectCustomerForDebt'))
        }
      } else {
        toast.error(error.message || tCommon('error'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Selection */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('customer')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={customerId || 'none'} onValueChange={(val) => setCustomerId(!val || val === 'none' ? '' : val)}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder={tCommon('select')}>
                {customerId ? customers.find((c) => c.id === customerId)?.name : tCommon('select')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{tCommon('select')}</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Responsible person — distinct from whoever is entering the sale. */}
      <Card className="border shadow-sm">
        <CardContent className="pt-6">
          <div className="max-w-sm">
            <AssigneeSelect
              value={assignedTo}
              onChange={setAssignedTo}
              users={assignableUsers}
            />
          </div>
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
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                        : 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
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
              <Select value={selectedProductId} onValueChange={(val) => handleProductChange(val || '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tCommon('select')}>
                    {selectedProductId ? products.find((p) => p.id === selectedProductId)?.name : tCommon('select')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.stock === 0}>
                      {p.name} — {formatCurrency(p.price)} ({t('availableStock')}: {p.stock} {p.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">{t('quantity')}</Label>
              <NumericInput
                value={tempQty}
                onChange={(val) => setTempQty(val)}
                allowDecimals={unitAllowsDecimals(products.find(p => p.id === selectedProductId)?.unit)}
                className="h-9"
              />
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-xs">{t('unitPrice')}</Label>
              <Input
                type="text"
                readOnly
                value={selectedProductId ? formatCurrency(products.find(p => p.id === selectedProductId)?.price ?? 0) : '—'}
                className="h-9 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              size="sm"
              className="h-9 bg-white text-violet-600 border-violet-300 hover:bg-violet-50 dark:bg-slate-900 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950/30"
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
                <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>{t('productName')}</TableHead>
                  <TableHead className="text-right">{t('unitPrice')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead className="text-right">{t('totalPrice')}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <TableCell className="text-center text-xs text-slate-500 dark:text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.totalPrice)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 dark:bg-slate-800 font-semibold">
                  <TableCell colSpan={4} className="text-right">{tCommon('total')}:</TableCell>
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
          onClick={() => exitForm()}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || items.length === 0 || (paymentMethod === 'debt' && !customerId)}
          className="bg-violet-600 hover:bg-violet-500"
        >
          {isSubmitting ? tCommon('loading') : tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
