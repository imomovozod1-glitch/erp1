'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useSidebarOffset } from '@/lib/hooks/use-sidebar-offset'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PosAddCustomerDialog } from '@/components/pos/pos-add-customer-dialog'
import { PosCartPanel } from '@/components/pos/pos-cart-panel'
import { PosCheckoutBar } from '@/components/pos/pos-checkout-bar'
import { PosPrintStyles } from '@/components/pos/pos-print-styles'
import { PosProductGrid } from '@/components/pos/pos-product-grid'
import { PosReceiptDialog } from '@/components/pos/pos-receipt-dialog'
import { usePosCart } from '@/components/pos/use-pos-cart'
import { usePosCatalogue } from '@/components/pos/use-pos-catalogue'
import { usePosCheckout } from '@/components/pos/use-pos-checkout'
import { usePosSale } from '@/components/pos/use-pos-sale'
import { useReceiptConfig } from '@/components/pos/use-receipt-config'

interface POSClientProps {
  initialProducts: any[]
  initialCategories: any[]
  initialCustomers: any[]
  lang: string
  company: { name: string; phone?: string }
  cashierName: string
}

function useTill({ initialProducts, initialCustomers, company, cashierName }: POSClientProps) {
  const t = useTranslations('pos')
  const cart = usePosCart({ catalogue: initialProducts, onStockExceeded: () => toast.error(t('insufficientStock')) })
  const sale = usePosSale(initialCustomers)
  const catalogue = usePosCatalogue(initialProducts, (product) => {
    if (!product) return void toast.error(t('productNotFound'))
    cart.add(product)
    toast.success(t('addedToCart', { name: product.name }))
  })
  const clearTill = () => {
    cart.reset()
    sale.reset()
  }
  const checkout = usePosCheckout({ cart, catalogue, customer: sale.customer, paymentMethod: sale.paymentMethod, cashierName, company, clearTill })
  return { cart, sale, catalogue, checkout, clearTill }
}

export function POSClient(props: POSClientProps) {
  const t = useTranslations('pos')
  const sidebarOffset = useSidebarOffset()
  const { cart, sale, catalogue, checkout, clearTill } = useTill(props)
  const receipt = useReceiptConfig()
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const quantities = useMemo(() => new Map(cart.items.map((i) => [i.product.id, i.quantity])), [cart.items])
  const panel = { cart, sale, onAddCustomer: () => setAddingCustomer(true), onClear: clearTill }

  return (
    <div className={`relative select-none md:fixed md:top-16 md:right-0 md:bottom-0 md:flex md:flex-col md:overflow-hidden md:p-6 ${sidebarOffset}`}>
      <PosPrintStyles widthMm={receipt.widthMm} />
      <div className="no-print grid grid-cols-1 items-stretch gap-6 overflow-hidden md:h-full md:min-h-0 md:flex-1 md:grid-cols-3">
        <PosProductGrid
          products={catalogue.visible}
          categories={props.initialCategories}
          search={catalogue.search}
          onSearchChange={catalogue.setSearch}
          onSearchKeyDown={catalogue.onSearchKeyDown}
          selectedCategory={catalogue.category}
          onCategoryChange={catalogue.setCategory}
          onSelect={cart.add}
          inputRef={catalogue.searchRef}
          quantities={quantities}
        />
        <PosCartPanel {...panel} onCheckout={checkout.checkout} />
      </div>
      <PosCheckoutBar count={cart.items.length} total={cart.total} onOpen={() => setCartOpen(true)} />
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="no-print gap-0 p-0 max-sm:min-h-[70dvh] md:hidden" showCloseButton>
          <DialogTitle className="sr-only">{t('cart')}</DialogTitle>
          <PosCartPanel
            {...panel}
            variant="sheet"
            onAddMore={() => setCartOpen(false)}
            onCheckout={() => {
              setCartOpen(false)
              checkout.checkout()
            }}
          />
        </DialogContent>
      </Dialog>
      <PosAddCustomerDialog open={addingCustomer} onOpenChange={setAddingCustomer} onCreated={sale.addCustomer} />
      <PosReceiptDialog
        order={checkout.receipt}
        status={checkout.status}
        company={props.company}
        config={receipt.config}
        onClose={checkout.closeReceipt}
        onPrint={checkout.print}
      />
    </div>
  )
}
