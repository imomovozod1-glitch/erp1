'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { invalidatePurchaseOrders, invalidateProducts, invalidateMovements } from '@/lib/data/revalidate'
import { recordCostLayer } from '@/lib/inventory-costing'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, Sparkles, Upload, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PurchaseOrderFormProps {
  suppliers: { id: string; name: string }[]
  products: { id: string; name: string; price: number; cost_price: number; stock: number; unit: string; sku: string }[]
  lang: string
}

interface LineItem {
  productId: string
  productName: string
  quantity: number
  unitCost: number
  totalCost: number
}

function generatePoNumber() {
  return `PO-${Date.now().toString().slice(-8)}`
}

export function PurchaseOrderForm({ suppliers, products, lang }: PurchaseOrderFormProps) {
  const t = useTranslations('procurement')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([])

  // Temp item state
  const [selectedProductId, setSelectedProductId] = useState('')
  const [tempQty, setTempQty] = useState<number | ''>(1)
  const [tempUnitCost, setTempUnitCost] = useState<number | ''>('')

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId)
    const product = products.find(p => p.id === productId)
    if (product) {
      setTempUnitCost(product.cost_price)
    }
  }

  const addItem = () => {
    const qty = Number(tempQty) || 0
    const cost = Number(tempUnitCost) || 0
    if (!selectedProductId || qty <= 0) return
    const product = products.find(p => p.id === selectedProductId)
    if (!product) return

    setItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitCost: cost,
      totalCost: qty * cost,
    }])
    setSelectedProductId('')
    setTempQty(1)
    setTempUnitCost('')
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const totalAmount = items.reduce((sum, item) => sum + item.totalCost, 0)

  const handleScanInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsScanning(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/inventory/scan', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      // Match supplier if returned
      if (data.supplier && Array.isArray(suppliers)) {
        const matchedSupplier = suppliers.find(
          s => s.name.toLowerCase().includes(data.supplier.toLowerCase()) ||
               data.supplier.toLowerCase().includes(s.name.toLowerCase())
        )
        if (matchedSupplier) {
          setSupplierId(matchedSupplier.id)
          toast.success(`Ta'minotchi aniqlandi: ${matchedSupplier.name}`)
        } else {
          toast.info(`Ta'minotchi aniqlandi (${data.supplier}), lekin tizimda bunday ta'minotchi topilmadi.`)
        }
      }

      if (data.items && Array.isArray(data.items)) {
        const scannedItems: LineItem[] = data.items.map((item: any) => {
          // Try to match with existing products by name or SKU
          const matchedProduct = products.find(
            p => p.name.toLowerCase().includes(item.name?.toLowerCase() ?? '') ||
                 (item.sku && p.sku.toLowerCase() === item.sku.toLowerCase())
          )
          const qty = item.quantity ?? item.stock ?? 1
          const cost = item.cost_price ?? item.price ?? 0
          return {
            productId: matchedProduct?.id ?? '',
            productName: item.name ?? 'Unknown',
            quantity: qty,
            unitCost: cost,
            totalCost: qty * cost,
          }
        })
        setItems(prev => [...prev, ...scannedItems])
        toast.success(`${scannedItems.length} ta mahsulot aniqlandi`)
      }
    } catch {
      toast.error(tCommon('error'))
    } finally {
      setIsScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // The button's own disabled state can lag a render behind the click,
    // so re-check synchronously before doing any work — this form writes to
    // purchase_orders, purchase_order_items, and increments product stock in
    // a loop with no atomic transaction, so a double-fire would double-credit stock.
    if (isSubmitting) return
    if (!supplierId || items.length === 0) {
      toast.error(tCommon('required'))
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient() as any

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Generate PO number
      const poNumber = generatePoNumber()

      // Create purchase order
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          po_number: poNumber,
          supplier_id: supplierId,
          status: 'received' as any,
          total_amount: totalAmount,
          notes,
          created_by: user.id,
        } as any])
        .select()
        .single()

      if (poError) throw poError

      // Create purchase order items
      const poItems = items.map(item => ({
        po_id: po.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        received_qty: item.quantity,
        total_cost: item.totalCost,
      }))

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems as any)

      if (itemsError) throw itemsError

      // Update product stock (add incoming stock) and create stock movements
      for (const item of items) {
        if (!item.productId) continue

        const product = products.find(p => p.id === item.productId)
        if (!product) continue

        const quantityBefore = product.stock
        const quantityAfter = quantityBefore + item.quantity

        // Update stock
        await supabase
          .from('products')
          .update({ stock: quantityAfter } as any)
          .eq('id', item.productId)

        // Create stock movement
        await supabase
          .from('stock_movements')
          .insert([{
            product_id: item.productId,
            type: 'in' as any,
            quantity: item.quantity,
            quantity_before: quantityBefore,
            quantity_after: quantityAfter,
            reference_type: 'purchase_order',
            reference_id: po.id,
            reason: `Purchase from ${suppliers.find(s => s.id === supplierId)?.name ?? 'supplier'}`,
            unit_cost: item.unitCost,
            total_cost: item.totalCost,
            created_by: user.id,
          } as any])

        // Record a cost layer at the price actually paid for this receipt, so
        // FIFO/LIFO/AVECO have real data to consume from on future sales.
        await recordCostLayer(supabase, {
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          sourceType: 'purchase_order',
          sourceId: po.id,
        })
      }

      await Promise.all([invalidatePurchaseOrders(), invalidateProducts(), invalidateMovements()])
      toast.success(t('purchaseCreated'))
      router.push(`/${lang}/procurement/purchase-orders`)
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      {/* Supplier + AI Scan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('supplier')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('selectSupplier')} *</Label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{tCommon('select')}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{tCommon('notes')}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tCommon('notes')}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-linear-to-br from-indigo-50/50 to-purple-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              {t('scanInvoice')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{t('scanInvoiceDesc')}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScanInvoice}
              className="hidden"
              id="scan-input"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="w-full h-20 border-dashed border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
            >
              {isScanning ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  <span className="text-indigo-700">{lang === 'uz' ? 'AI tahlil qilmoqda...' : lang === 'ru' ? 'ИИ анализирует...' : 'AI is analyzing...'}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="h-6 w-6 text-indigo-500" />
                  <span className="text-sm text-indigo-700 font-medium">{lang === 'uz' ? 'Rasm yuklash' : lang === 'ru' ? 'Загрузить изображение' : 'Upload image'}</span>
                </div>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Add Item Row */}
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
                  <option key={p.id} value={p.id}>{p.name}</option>
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
              <Label className="text-xs">{t('unitCost')}</Label>
              <NumericInput
                value={tempUnitCost}
                onChange={(val) => setTempUnitCost(val)}
                className="h-9"
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
      {items.length > 0 && (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>{t('product')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead className="text-right">{t('unitCost')}</TableHead>
                  <TableHead className="text-right">{t('totalCost')}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium">
                      {item.productId ? (
                        item.productName
                      ) : (
                        <div className="flex flex-col gap-1.5 max-w-md">
                          <span className="text-red-500 text-xs font-semibold">Tizimdagi tovar bilan bog&apos;lanmagan: &quot;{item.productName}&quot;</span>
                          <select
                            value={item.productId}
                            onChange={(e) => {
                              const prodId = e.target.value
                              const prod = products.find(p => p.id === prodId)
                              if (prod) {
                                setItems(prev => prev.map((it, i) => i === idx ? {
                                  ...it,
                                  productId: prod.id,
                                  productName: prod.name,
                                } : it))
                              }
                            }}
                            className="flex h-9 w-full rounded-md border border-red-300 bg-white px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                          >
                            <option value="">{t('selectProduct')}...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.totalCost)}</TableCell>
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
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${lang}/procurement/purchase-orders`)}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || items.length === 0 || !supplierId || items.some(item => !item.productId)}
          className="bg-indigo-600 hover:bg-indigo-500"
        >
          {isSubmitting ? tCommon('loading') : tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
