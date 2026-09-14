'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { generateDocumentNumber } from '@/lib/utils'
import {
  invalidateProducts,
  invalidateOrders,
  invalidateOrderItems,
  invalidateTransactions,
  invalidateMovements,
  invalidateCustomers,
  invalidateInvoices
} from '@/lib/data/revalidate'
import { useSidebarOffset } from '@/lib/hooks/use-sidebar-offset'
import { toast } from 'sonner'
import { printReceiptDirect } from '@/lib/printer/print'
import { getPrinterConfig, DEFAULT_PRINTER_CONFIG, type PrinterConfig } from '@/lib/printer/storage'
import { usePosCart } from '@/components/pos/use-pos-cart'
import { submitPosSale } from '@/components/pos/checkout'
import { PosReceiptDialog, type ReceiptOrder } from '@/components/pos/pos-receipt-dialog'
import { PosAddCustomerDialog } from '@/components/pos/pos-add-customer-dialog'
import { PosProductGrid } from '@/components/pos/pos-product-grid'
import { PosCartPanel } from '@/components/pos/pos-cart-panel'
import { fireTelegramNotification } from '@/lib/integrations/notify-client'

/**
 * The till.
 *
 * This file is the composition root — it holds the sale's state (basket,
 * customer, payment method) and wires the pieces together; the pieces
 * themselves live beside it:
 *
 *   use-pos-cart.ts          the basket and its money
 *   checkout.ts              the writes a completed sale performs
 *   pos-product-grid.tsx     search, categories, the product tiles
 *   pos-cart-panel.tsx       basket, customer, payment, the checkout button
 *   pos-add-customer-dialog  "new customer" without leaving the till
 *   pos-receipt-dialog.tsx   the thermal receipt
 *
 * It was one 1450-line file. Splitting it along those seams is what makes each
 * of them readable on its own: the basket rules without the accounting, the
 * accounting without the JSX, the JSX without either.
 */
interface POSClientProps {
  initialProducts: any[]
  initialCategories: any[]
  initialCustomers: any[]
  lang: string
  /** Receipt header, read from the tenant row on the server. */
  company: { name: string; phone?: string }
  /** Printed on the receipt; read from the cached profile on the server. */
  cashierName: string
}

export function POSClient({
  initialProducts,
  initialCategories,
  initialCustomers,
  company,
  cashierName,
  lang
}: POSClientProps) {
  // The screen's own namespace is declared last on purpose — see AGENTS.md
  // § Translations: the editor resolves a bare `t(...)` to whichever
  // `useTranslations()` comes last in the file.
  const tCommon = useTranslations('common')
  const t = useTranslations('pos')
  const sidebarOffset = useSidebarOffset()

  // State
  const [products, setProducts] = useState(initialProducts)
  const [categories] = useState(initialCategories)
  const [customers, setCustomers] = useState(initialCustomers)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // The basket, its discount and the money they add up to — see use-pos-cart.ts.
  const cart = usePosCart({
    catalogue: initialProducts,
    onStockExceeded: () => toast.error(t('insufficientStock')),
  })

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'debt'>('cash')

  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<ReceiptOrder | null>(null)
  // Whether the sale behind the receipt on screen has landed yet.
  const [saleStatus, setSaleStatus] = useState<'saving' | 'saved' | 'failed'>('saved')
  // Receipt header. Arrives with the page — it used to be a round trip to
  // `tenants` fired after hydration, for two strings that are printed on a
  // receipt the cashier may never open.
  const companyInfo = company
  /* Receipt wording/lines, configured in Settings → Receipt. Read after mount
     rather than in the initialiser: getPrinterConfig() touches localStorage,
     which does not exist during the server render and would desync hydration. */
  const [receiptConfig, setReceiptConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG)
  useEffect(() => {
    const timer = setTimeout(() => setReceiptConfig(getPrinterConfig()), 0)
    return () => clearTimeout(timer)
  }, [])
  
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Focus search input on mount for barcode scanner readiness
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])


  /*
   * Memoised because this component re-renders on every cart interaction —
   * adding an item, changing a quantity, typing a discount — and without it the
   * entire catalogue was re-filtered, and the whole product grid re-rendered,
   * each time. On a till with a few thousand products that is what made adding
   * to the basket feel heavy. (React Compiler would do this automatically, but
   * it is not enabled in next.config.ts — only its lint rules are.)
   */
  const filteredProducts = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    const matches = products.filter((p) => {
      const matchesSearch =
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle)
      const matchesCategory =
        selectedCategory === 'all' || p.category_id === selectedCategory
      return matchesSearch && matchesCategory
    })

    // Sold-out products stay in the grid — a cashier has to be able to tell
    // "we stock this and it is finished" from "we do not stock this", and the
    // second is what hiding them would say. They sink to the end instead, so
    // they never take a tile the cashier could have tapped.
    return matches.sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0))
  }, [products, searchQuery, selectedCategory])

  /** Empties the basket AND the sale around it — customer and payment method. */
  const clearTill = () => {
    cart.reset()
    setSelectedCustomer(null)
    setPaymentMethod('cash')
  }

  // Auto-add product if SKU is exact barcode scanner match on Enter
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = searchQuery.trim()
      if (!trimmed) return

      const matched = products.find(
        (p) => p.sku.toLowerCase() === trimmed.toLowerCase()
      )

      if (matched) {
        cart.add(matched)
        setSearchQuery('')
        toast.success(`${matched.name} ${tCommon('success')}`)
      } else {
        toast.error(t('productNotFound'))
      }
    }
  }

  /**
   * Rings up the sale.
   *
   * The receipt appears on the click, not after the writes. Everything printed
   * on it — the order number, the lines, the totals, the cashier — is known
   * before a single row is written, and committing a sale is seven round trips
   * deep (order → cost layers → lines, stock, movements, invoice, cashbox).
   * Against a Supabase project ~500 ms away that was three seconds of spinner
   * between the cashier pressing the button and being able to hand over a
   * receipt, for information the till already had.
   *
   * So the sale is committed in the background and the receipt carries its own
   * state: `saving` while the writes run, `failed` if they do not land. That
   * last part is not decoration — the cashier has taken the money by then, and
   * has to be told plainly if the sale did not save.
   */
  const handleCheckout = () => {
    if (cart.items.length === 0) {
      toast.error(t('emptyCart'))
      return
    }
    // Debt requires a customer.
    if (paymentMethod === 'debt' && !selectedCustomer) {
      toast.error(t('selectCustomerForDebt'))
      return
    }

    // Captured before the till is cleared below — `cart` is emptied
    // immediately, but the writes still need what was in it.
    const soldItems = cart.items
    const totals = {
      subtotal: cart.subtotal,
      discount: cart.discount,
      tax: cart.tax,
      total: cart.total,
    }
    const customer = selectedCustomer
    const method = paymentMethod
    const orderNumber = generateDocumentNumber('SO-POS')

    setCheckoutSuccessOrder({
      orderNumber,
      date: new Date().toLocaleString(),
      cashier: cashierName,
      customerName: customer ? customer.name : t('walkInCustomer'),
      items: soldItems.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        price: i.product.price,
        discount: i.discountPercent,
        total: i.product.price * (1 - i.discountPercent / 100) * i.quantity,
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      paymentMethod: method,
    })
    setSaleStatus('saving')

    // The catalogue is decremented from what this screen knows; the figures are
    // corrected below from what the database actually held.
    setProducts(
      products.map((p) => {
        const sold = soldItems.find((ci) => ci.product.id === p.id)
        return sold ? { ...p, stock: p.stock - sold.quantity } : p
      })
    )
    clearTill()

    void (async () => {
      try {
        const sale = await submitPosSale({
          supabase: createClient(),
          orderNumber,
          items: soldItems,
          customer,
          paymentMethod: method,
          totals,
          messages: {
            sessionNotFound: tCommon('sessionNotFound'),
            insufficientStock: t('insufficientStock'),
          },
        })

        setSaleStatus('saved')
        toast.success(t('orderSuccess'))

        // Re-apply the stock from the values the sale actually deducted from,
        // in case another till moved them between page load and this sale.
        setProducts((current) =>
          current.map((p) => {
            const sold = soldItems.find((ci) => ci.product.id === p.id)
            return sold && sale.stockBefore.has(p.id)
              ? { ...p, stock: (sale.stockBefore.get(p.id) as number) - sold.quantity }
              : p
          })
        )

        // Never awaited and never throws: the sale is committed, so a Telegram
        // outage must not turn it into an error.
        fireTelegramNotification({
          event: 'sale',
          data: {
            orderNumber,
            total: totals.total,
            paymentMethod: method,
            itemCount: soldItems.length,
            customerName: customer?.name ?? null,
          },
        })

        // Warn about anything this sale pushed to or below its minimum level.
        for (const item of soldItems) {
          const remaining =
            (sale.stockBefore.get(item.product.id) ?? item.product.stock) - item.quantity
          const minStock = Number(item.product.min_stock) || 0
          if (minStock > 0 && remaining <= minStock) {
            fireTelegramNotification({
              event: 'low_stock',
              data: {
                productName: item.product.name,
                sku: item.product.sku,
                stock: remaining,
                minStock,
              },
            })
          }
        }

        // Cache invalidation is for *other* pages (reports, stock lists) on
        // their next visit. Nothing here waits for it.
        void Promise.all([
          invalidateProducts(),
          invalidateOrders(),
          invalidateOrderItems(),
          invalidateTransactions(),
          invalidateMovements(),
          invalidateCustomers(),
          invalidateInvoices(),
        ]).catch(() => {
          // A failed revalidation only means another page may show stale
          // numbers until its cache window lapses; the sale is already saved.
        })
      } catch (error: any) {
        setSaleStatus('failed')
        toast.error(error.message || tCommon('error'))
        // Put the optimistic stock back: this sale did not happen.
        setProducts((current) =>
          current.map((p) => {
            const sold = soldItems.find((ci) => ci.product.id === p.id)
            return sold ? { ...p, stock: p.stock + sold.quantity } : p
          })
        )
      }
    })()
  }

  // Tries a direct ESC/POS print via the printer configured in Settings →
  // Printer first (no OS print dialog); falls back to the browser's Print
  // dialog if no direct printer is paired/configured or the send fails.
  const triggerPrintReceipt = async () => {
    if (checkoutSuccessOrder) {
      const result = await printReceiptDirect(checkoutSuccessOrder, companyInfo, {
        receipt: t('receipt'),
        date: tCommon('date'),
        cashier: t('cashier'),
        customer: t('customer'),
        subtotal: t('subtotal'),
        discount: t('discount'),
        tax: t('tax'),
        total: t('total'),
        paymentMethod: t('paymentMethod'),
        thankYou: t('thankYou'),
      })
      if (result.ok) {
        toast.success(t('printedDirectly'))
        return
      }
    }
    window.print()
  }

  return (
    <div
      className={`relative select-none md:fixed md:top-16 md:right-0 md:bottom-0 md:flex md:flex-col md:overflow-hidden md:p-6 ${sidebarOffset}`}
    >
      {/* Print & Scrollbar Style Injection */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #pos-thermal-receipt, #pos-thermal-receipt * {
            visibility: visible;
          }
          #pos-thermal-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 4mm;
            background: white;
            color: black;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
          }
          .no-print {
            display: none !important;
          }
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print items-stretch md:h-full md:min-h-0 md:flex-1 overflow-hidden">
        <PosProductGrid
          products={filteredProducts}
          categories={categories}
          search={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchKeyDown={handleSearchKeyPress}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onSelect={cart.add}
          inputRef={searchInputRef}
        />

        <PosCartPanel
          cart={cart}
          customers={customers}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
          onAddCustomer={() => setIsAddCustomerOpen(true)}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          onClear={clearTill}
          onCheckout={handleCheckout}
          isCheckingOut={false}
          lang={lang}
        />
      </div>

      <PosAddCustomerDialog
        open={isAddCustomerOpen}
        onOpenChange={setIsAddCustomerOpen}
        onCreated={(customer) => {
          setCustomers([...customers, customer])
          setSelectedCustomer(customer)
        }}
        lang={lang}
      />

      <PosReceiptDialog
        order={checkoutSuccessOrder}
        status={saleStatus}
        company={companyInfo}
        config={receiptConfig}
        onClose={() => setCheckoutSuccessOrder(null)}
        onPrint={triggerPrintReceipt}
      />
    </div>
  )
}
