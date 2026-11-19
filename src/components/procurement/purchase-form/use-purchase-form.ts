'use client'

import { useState, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { callBusinessRpc, RPC_MISSING } from '@/lib/business-rpc'
import { invalidatePurchase } from '@/lib/data/revalidate'
import { errorMessage } from '@/lib/error-message'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { createClient } from '@/lib/supabase/client'
import { generateDocumentNumber, isoDate } from '@/lib/utils'
import { receivePurchaseInBrowser, type BrowserPurchase } from './purchase-in-browser'
import {
  addProductLine,
  matchSupplier,
  paymentMethodOf,
  removeLine,
  scannedLines,
  totalOf,
  unmatchedLines,
  updateLine,
  type PurchaseCashbox,
  type PurchaseLine,
  type PurchaseProduct,
} from './purchase-lines'

interface PurchaseFormConfig {
  suppliers: { id: string; name: string }[]
  products: PurchaseProduct[]
  cashboxes: PurchaseCashbox[]
  lang: string
}

const rpcPurchase = (p: BrowserPurchase, cashboxId: string | null, method: ReturnType<typeof paymentMethodOf>) => ({
  po_number: p.poNumber,
  supplier_id: p.supplierId,
  total_amount: p.total,
  notes: p.notes,
  assigned_to: p.assignedTo,
  order_date: isoDate(),
  payment_method: method,
  cashbox_id: cashboxId,
  items: p.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, unit_cost: l.unitCost, total_cost: l.totalCost })),
})

export function usePurchaseForm({ suppliers, products, cashboxes, lang }: PurchaseFormConfig) {
  const t = useTranslations()
  const exitForm = useRouteModalExit(`/${lang}/procurement/purchase-orders`)
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  // `null` = on account: the purchase becomes a debt to the supplier.
  const [cashboxId, setCashboxId] = useState<string | null>(null)
  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const cashbox = cashboxes.find((c) => c.id === cashboxId) ?? null
  const total = totalOf(lines)

  const addProduct = (id: string) => {
    const product = products.find((p) => p.id === id)
    if (!product) return false
    setLines(addProductLine(lines, product))
  }
  const matchLine = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (product) setLines(updateLine(lines, index, { productId: product.id, productName: product.name }))
  }

  const applyScan = (data: any) => {
    if (data.supplier) {
      const supplier = matchSupplier(suppliers, data.supplier)
      if (supplier) setSupplierId(supplier.id)
      if (supplier) toast.success(t('procurement.scan.supplierMatched', { name: supplier.name }))
      else toast.info(t('procurement.scan.supplierNotFound', { name: data.supplier }))
    }
    if (!Array.isArray(data.items)) return
    const scanned = scannedLines(data.items, products, t('procurement.scan.unknownProduct'))
    setLines((current) => [...current, ...scanned])
    toast.success(t('procurement.scan.itemsFound', { count: scanned.length }))
  }

  const scanInvoice = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setScanning(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const data = await (await fetch('/api/inventory/scan', { method: 'POST', body })).json()
      if (data.error) toast.error(errorMessage(t, data, t('common.error')))
      else applyScan(data)
    } catch {
      toast.error(t('common.error'))
    } finally {
      setScanning(false)
    }
  }

  const receive = async (purchase: BrowserPurchase) => {
    const supabase = createClient()
    const method = paymentMethodOf(cashbox)
    const received = await callBusinessRpc(supabase, 'receive_purchase', { p_purchase: rpcPurchase(purchase, cashboxId, method) })
    if (received !== RPC_MISSING) return true
    // The browser path cannot move money: a paid purchase would be recorded as a debt.
    if (method !== null) return void toast.error(t('procurement.payment.migrationRequired'), { duration: 10000 })
    await receivePurchaseInBrowser(supabase, purchase)
    return true
  }

  const submit = async (e: React.SubmitEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!supplierId || !lines.length) return void toast.error(t('common.required'))
    const unmatched = unmatchedLines(lines)
    if (unmatched.length) return void toast.error(`${t('common.required')}: ${unmatched.map((l) => l.productName).join(', ')}`)
    setSubmitting(true)
    try {
      const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? ''
      const ok = await receive({ poNumber: generateDocumentNumber('PO'), supplierId, supplierName, notes, assignedTo, lines, total })
      if (!ok) return
      await invalidatePurchase()
      toast.success(t('procurement.purchaseCreated'))
      exitForm()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      setSubmitting(false)
    }
  }

  return {
    supplierId, setSupplierId, notes, setNotes, assignedTo, setAssignedTo, cashbox, setCashboxId,
    lines, total, scanning, submitting, products,
    addProduct, matchLine,
    changeLine: (index: number, patch: Partial<PurchaseLine>) => setLines(updateLine(lines, index, patch)),
    remove: (index: number) => setLines(removeLine(lines, index)),
    scanInvoice, submit, exitForm,
    canSubmit: !!supplierId && lines.length > 0 && !unmatchedLines(lines).length,
  }
}

export type PurchaseFormState = ReturnType<typeof usePurchaseForm>
