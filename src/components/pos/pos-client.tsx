'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import {
  invalidateProducts,
  invalidateOrders,
  invalidateOrderItems,
  invalidateTransactions,
  invalidateMovements,
  invalidateCustomers,
  invalidateInvoices
} from '@/lib/data/revalidate'
import { useSidebar } from '@/components/ui/sidebar'
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
}

export function POSClient({
  initialProducts,
  initialCategories,
  initialCustomers,
  company,
  lang
}: POSClientProps) {
  // The screen's own namespace is declared last on purpose — see AGENTS.md
  // § Translations: the editor resolves a bare `t(...)` to whichever
  // `useTranslations()` comes last in the file.
  const tCommon = useTranslations('common')
  const t = useTranslations('pos')
  const { state: sidebarState, isMobile: isSidebarMobile } = useSidebar()

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

  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false)
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<ReceiptOrder | null>(null)
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
    return products.filter((p) => {
      const matchesSearch =
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle)
      const matchesCategory =
        selectedCategory === 'all' || p.category_id === selectedCategory
      return matchesSearch && matchesCategory
    })
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
   * Rings up the sale, then updates this screen.
   *
   * The writes themselves live in `checkout.ts`; what is left here is what the
   * till does about them — validate, show the receipt, refresh the on-screen
   * stock, empty the basket and let the rest of the app know.
   */
  const handleCheckout = async () => {
    if (cart.items.length === 0) {
      toast.error(t('emptyCart'))
      return
    }
    // Debt requires a customer.
    if (paymentMethod === 'debt' && !selectedCustomer) {
      toast.error(t('selectCustomerForDebt'))
      return
    }

    setIsLoadingCheckout(true)
    try {
      const sale = await submitPosSale({
        supabase: createClient(),
        items: cart.items,
        customer: selectedCustomer,
        paymentMethod,
        totals: {
          subtotal: cart.subtotal,
          discount: cart.discount,
          tax: cart.tax,
          total: cart.total,
        },
        messages: {
          sessionNotFound: tCommon('sessionNotFound'),
          insufficientStock: t('insufficientStock'),
        },
      })

      toast.success(t('orderSuccess'))

      // Deliberately not awaited and never throws: the sale is already
      // committed, so a Telegram outage must not turn it into an error toast.
      fireTelegramNotification({
        event: 'sale',
        data: {
          orderNumber: sale.orderNumber,
          total: cart.total,
          paymentMethod,
          itemCount: cart.items.length,
          customerName: selectedCustomer?.name ?? null,
        },
      })

      // Warn about anything this sale pushed to or below its minimum level.
      for (const item of cart.items) {
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

      setCheckoutSuccessOrder({
        orderNumber: sale.orderNumber,
        date: new Date().toLocaleString(),
        cashier: sale.cashierName,
        customerName: selectedCustomer ? selectedCustomer.name : t('walkInCustomer'),
        items: cart.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          price: i.product.price,
          discount: i.discountPercent,
          total: i.product.price * (1 - i.discountPercent / 100) * i.quantity,
        })),
        subtotal: cart.subtotal,
        discount: cart.discount,
        tax: cart.tax,
        total: cart.total,
        paymentMethod,
      })

      // Bring the on-screen catalogue in line with what was written — based on
      // the stock the sale actually deducted from, not on this page's snapshot.
      setProducts(
        products.map((p) => {
          const sold = cart.items.find((ci) => ci.product.id === p.id)
          return sold
            ? { ...p, stock: (sale.stockBefore.get(p.id) ?? p.stock) - sold.quantity }
            : p
        })
      )

      // Reset the till immediately. This used to run *after* awaiting the seven
      // cache invalidations below, so the sale was already committed and the
      // receipt already on screen while the just-sold items sat in the basket
      // for as long as those round trips took — the cashier closed the receipt
      // and watched it empty itself a couple of seconds later.
      clearTill()

      // Cache invalidation is for *other* pages (reports, stock lists) on their
      // next visit. Nothing on this screen is waiting for it, so it must not
      // hold the till.
      void Promise.all([
        invalidateProducts(),
        invalidateOrders(),
        invalidateOrderItems(),
        invalidateTransactions(),
        invalidateMovements(),
        invalidateCustomers(),
        invalidateInvoices(),
      ]).catch(() => {
        // A failed revalidation only means another page may show stale numbers
        // until its own cache window lapses; the sale itself is already saved.
      })
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsLoadingCheckout(false)
    }
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
      className={`relative select-none md:fixed md:top-16 md:right-0 md:bottom-0 md:flex md:flex-col md:overflow-hidden md:p-6 transition-[left] duration-200 ease-linear ${
        isSidebarMobile ? 'md:left-0' : sidebarState === 'expanded' ? 'md:left-(--sidebar-width)' : 'md:left-(--sidebar-width-icon)'
      }`}
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
          isCheckingOut={isLoadingCheckout}
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
        company={companyInfo}
        config={receiptConfig}
        onClose={() => setCheckoutSuccessOrder(null)}
        onPrint={triggerPrintReceipt}
      />
    </div>
  )
}
