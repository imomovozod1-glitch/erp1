'use client'

import { Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PosCartLine } from '@/components/pos/cart/pos-cart-line'
import { CheckoutButton, CustomerPicker, GeneralDiscount, PaymentMethods, SaleTotals } from '@/components/pos/cart/pos-sale-controls'
import type { PosCart } from '@/components/pos/use-pos-cart'
import type { PosSale } from '@/components/pos/use-pos-sale'

interface PosCartPanelProps {
  cart: PosCart
  sale: PosSale
  onAddCustomer: () => void
  onClear: () => void
  onCheckout: () => void
  /** `panel` is the desktop column beside the products, `sheet` the phone bottom sheet. */
  variant?: 'panel' | 'sheet'
  onAddMore?: () => void
}

function CartHeader({ count, onClear }: { count: number; onClear: () => void }) {
  const t = useTranslations()
  return (
    <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-border/60 p-4 md:p-3">
      <div className="flex items-center gap-3">
        <div className="relative flex size-10 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-brand">
          <ShoppingBag className="size-5" />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1 text-[11px] font-bold text-violet-700 tabular-nums ring-2 ring-violet-600 dark:text-violet-300">
              {count}
            </span>
          )}
        </div>
        <CardTitle className="text-base font-bold tracking-tight">{t('pos.cart')}</CardTitle>
      </div>
      {count > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-9 gap-1.5 rounded-full px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
        >
          <Trash2 className="size-3.5" />
          {t('common.clear')}
        </Button>
      )}
    </CardHeader>
  )
}

function EmptyCart() {
  const t = useTranslations('pos')
  return (
    <div className="flex h-full min-h-52 flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-violet-100 text-violet-500 dark:bg-violet-500/15 dark:text-violet-300">
        <ShoppingBag className="size-7" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{t('emptyCart')}</p>
        <p className="text-xs text-muted-foreground">{t('cartHint')}</p>
      </div>
    </div>
  )
}

function AddMoreButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('common')
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 text-sm font-semibold text-violet-700 transition-colors active:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:active:bg-violet-500/10"
    >
      <Plus className="size-4" />
      {t('add')}
    </button>
  )
}

/** The sale half of the till: basket, customer, discount, payment and the button that commits it. */
export function PosCartPanel({ cart, sale, onAddCustomer, onClear, onCheckout, variant = 'panel', onAddMore }: PosCartPanelProps) {
  const sheet = variant === 'sheet'
  return (
    <div className={cn(sheet ? 'md:hidden' : 'overflow-hidden max-md:hidden md:col-span-1 md:flex md:h-full md:min-h-0 md:flex-col')}>
      <Card className={cn('flex min-h-0 flex-col bg-card pt-0', sheet ? 'rounded-none border-0 shadow-none ring-0' : 'h-full overflow-y-auto rounded-2xl border border-border/60 shadow-sm')}>
        <CartHeader count={cart.items.length} onClear={onClear} />
        <div className={cn('space-y-2.5 p-3', !sheet && 'min-h-28 flex-1 overflow-y-auto scrollbar-thin')}>
          {cart.items.length === 0 ? <EmptyCart /> : cart.items.map((item) => <PosCartLine key={item.product.id} item={item} cart={cart} sheet={sheet} />)}
          {sheet && onAddMore && <AddMoreButton onClick={onAddMore} />}
        </div>
        <div className="shrink-0 space-y-3 border-t border-border/60 bg-card p-3 md:space-y-2.5">
          <CustomerPicker sale={sale} onAdd={onAddCustomer} />
          <GeneralDiscount cart={cart} />
          <SaleTotals cart={cart} />
          <PaymentMethods sale={sale} />
          <CheckoutButton cart={cart} sale={sale} sheet={sheet} onCheckout={onCheckout} />
        </div>
      </Card>
    </div>
  )
}
