'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  CreditCard,
  Minus,
  Package,
  Percent,
  Plus,
  ShoppingBag,
  Trash2,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { unitAllowsDecimals } from '@/lib/units'
import type { PosCart } from '@/components/pos/use-pos-cart'
import type { PosPaymentMethod } from '@/components/pos/checkout'

/**
 * The sale half of the till: what is in the basket, who it is for, how it is
 * paid, and the button that commits it.
 *
 * Everything it shows comes from the `cart` hook or from props; it owns no
 * state. The customer and payment method are passed in rather than held here
 * because the checkout needs them and `onClear` resets them — they belong to
 * the sale, not to this panel.
 *
 * Two placements share this markup: `panel` is the desktop column beside the
 * products, `sheet` is the phone bottom sheet (bigger touch targets, the
 * total printed on the checkout button).
 */
export function PosCartPanel({
  cart,
  customers,
  selectedCustomer,
  onSelectCustomer,
  onAddCustomer,
  paymentMethod,
  onPaymentMethodChange,
  onClear,
  onCheckout,
  isCheckingOut,
  variant = 'panel',
  onAddMore,
}: {
  cart: PosCart
  customers: any[]
  selectedCustomer: any | null
  onSelectCustomer: (customer: any | null) => void
  /** Opens the quick-add dialog. */
  onAddCustomer: () => void
  paymentMethod: PosPaymentMethod
  onPaymentMethodChange: (method: PosPaymentMethod) => void
  /** Empties the basket and resets the sale around it. */
  onClear: () => void
  onCheckout: () => void
  isCheckingOut: boolean
  lang: string
  variant?: 'panel' | 'sheet'
  /** Phone sheet: back to the catalogue to add another product (the sale form's "add" step). */
  onAddMore?: () => void
}) {
  const sheet = variant === 'sheet'
  const tCommon = useTranslations('common')
  const t = useTranslations('pos')

  const stepBtn = cn(
    'flex items-center justify-center text-violet-700 transition-colors hover:bg-violet-100 active:bg-violet-200 dark:text-violet-300 dark:hover:bg-violet-500/20',
    sheet ? 'h-10 w-10' : 'h-8 w-8'
  )

  return (
    <div
      className={cn(
        sheet ? 'md:hidden' : 'overflow-hidden max-md:hidden md:col-span-1 md:flex md:h-full md:min-h-0 md:flex-col'
      )}
    >
      <Card
        className={cn(
          'flex min-h-0 flex-col bg-card pt-0',
          sheet ? 'rounded-none border-0 shadow-none ring-0' : 'h-full overflow-y-auto rounded-2xl border border-border/60 shadow-sm'
        )}
      >
        {/* Header: title, how many lines, clear. */}
        <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-border/60 p-4 md:p-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-brand">
              <ShoppingBag className="h-5 w-5" />
              {cart.items.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1 text-[11px] font-bold text-violet-700 tabular-nums ring-2 ring-violet-600 dark:text-violet-300">
                  {cart.items.length}
                </span>
              )}
            </div>
            <CardTitle className="text-base font-bold tracking-tight">{t('cart')}</CardTitle>
          </div>
          {cart.items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-9 cursor-pointer gap-1.5 rounded-full px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {tCommon('clear')}
            </Button>
          )}
        </CardHeader>

        {/* Lines */}
        <div
          className={cn(
            'space-y-2.5 p-3',
            sheet ? '' : 'min-h-28 flex-1 overflow-y-auto scrollbar-thin'
          )}
        >
          {cart.items.length === 0 ? (
            <div className="flex h-full min-h-52 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-100 text-violet-500 dark:bg-violet-500/15 dark:text-violet-300">
                <ShoppingBag className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{t('emptyCart')}</p>
                <p className="text-xs text-muted-foreground">{t('cartHint')}</p>
              </div>
            </div>
          ) : (
            cart.items.map((item) => {
              const finalPrice = item.product.price * (1 - item.discountPercent / 100)
              return (
                <div
                  key={item.product.id}
                  className="rounded-2xl border border-border/60 bg-background/60 p-3 shadow-xs transition-colors hover:border-violet-300 dark:hover:border-violet-700"
                >
                  <div className="flex items-start gap-3">
                    {/* The same picture the cashier just tapped — a cart of near-identical
                        names ("Coca-Cola 0.5" / "1.0") is checked by sight, not by reading. */}
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-violet-50 p-0.5 dark:bg-violet-500/10">
                      {item.product.image_url ? (
                        <Image
                          src={item.product.image_url}
                          alt={item.product.name}
                          fill
                          sizes="48px"
                          className="object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-violet-300 dark:text-violet-400/60">
                          <Package className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-[13px] leading-tight font-semibold">{item.product.name}</p>
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            {formatCurrency(item.product.price)}
                            {item.discountPercent > 0 && (
                              <span className="ml-1 font-semibold text-rose-500 dark:text-rose-400">
                                −{item.discountPercent}%
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={tCommon('delete')}
                          onClick={() => cart.remove(item.product.id)}
                          className={cn(
                            'flex shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400',
                            sheet ? 'h-9 w-9' : 'h-7 w-7'
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {/* Quantity stepper — a lavender pill */}
                    <div className="flex shrink-0 items-center overflow-hidden rounded-full bg-violet-50 dark:bg-violet-500/10">
                      <button
                        type="button"
                        aria-label="−"
                        onClick={() => cart.setQuantity(item.product.id, item.quantity - 1)}
                        className={stepBtn}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <NumericInput
                        value={item.quantity === 0 ? '' : item.quantity}
                        // Typed, not stepped: `setTypedQuantity` keeps the line alive
                        // through "0" and "0." on the way to a fractional quantity.
                        onChange={(val) => {
                          if (val === '') {
                            cart.clearQuantity(item.product.id)
                            return
                          }
                          cart.setTypedQuantity(item.product.id, val)
                        }}
                        allowDecimals={unitAllowsDecimals(item.product.unit)}
                        onBlur={() => {
                          if (item.quantity <= 0) {
                            cart.remove(item.product.id)
                          }
                        }}
                        className={cn(
                          'rounded-none border-0 bg-transparent p-0 text-center text-sm font-bold tabular-nums shadow-none focus:outline-none',
                          sheet ? 'h-10 w-12' : 'h-8 w-11'
                        )}
                      />
                      <button
                        type="button"
                        aria-label="+"
                        onClick={() => cart.setQuantity(item.product.id, item.quantity + 1)}
                        className={stepBtn}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Line discount */}
                    <label
                      className={cn(
                        'flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20',
                        sheet ? 'h-10' : 'h-8'
                      )}
                    >
                      <Percent className="h-3 w-3 text-muted-foreground" />
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        value={item.discountPercent || ''}
                        onChange={(e) => cart.setLineDiscount(item.product.id, Number(e.target.value))}
                        placeholder="0"
                        className="w-9 bg-transparent text-center text-xs tabular-nums outline-none"
                      />
                    </label>

                    <p className="ml-auto truncate text-sm font-extrabold tabular-nums text-violet-700 dark:text-violet-300">
                      {formatCurrency(finalPrice * item.quantity)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          {sheet && onAddMore && (
            <button
              type="button"
              onClick={onAddMore}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 text-sm font-semibold text-violet-700 transition-colors active:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:active:bg-violet-500/10"
            >
              <Plus className="h-4 w-4" />
              {tCommon('add')}
            </button>
          )}
        </div>

        {/* Customer, discount, totals, payment, checkout — fixed, never scrolls or shrinks */}
        <div className="shrink-0 space-y-3 border-t border-border/60 bg-card p-3 md:space-y-2.5">
          <div className="flex items-center gap-2">
            <Select
              value={selectedCustomer ? selectedCustomer.id : 'walk-in'}
              onValueChange={(val) => {
                if (val === 'walk-in') {
                  onSelectCustomer(null)
                } else {
                  const cust = customers.find((c) => c.id === val)
                  onSelectCustomer(cust ?? null)
                }
              }}
            >
              <SelectTrigger className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background text-xs font-medium focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 md:h-10">
                <SelectValue placeholder={t('walkInCustomer')}>
                  {selectedCustomer
                    ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
                    : t('walkInCustomer')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="walk-in" className="text-xs font-medium">{t('walkInCustomer')}</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={onAddCustomer}
              title={t('addCustomer')}
              className="h-11 w-11 shrink-0 cursor-pointer rounded-xl p-0 md:h-10 md:w-10"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">{t('generalDiscount')}</span>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              value={cart.generalDiscountValue || ''}
              onChange={(e) => cart.setGeneralDiscountValue(Number(e.target.value))}
              placeholder="0"
              className="h-11 min-w-0 flex-1 rounded-xl text-xs tabular-nums md:h-10"
            />
            {/* flat / percent as a two-state pill */}
            <div className="flex h-11 shrink-0 rounded-xl bg-violet-50 p-1 md:h-10 dark:bg-violet-500/10">
              {(['flat', 'percent'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => cart.setGeneralDiscountType(type)}
                  className={cn(
                    'cursor-pointer rounded-lg px-3 text-xs font-bold transition-colors',
                    cart.generalDiscountType === type
                      ? 'bg-card text-violet-700 shadow-sm dark:text-violet-300'
                      : 'text-muted-foreground'
                  )}
                >
                  {type === 'percent' ? '%' : "so'm"}
                </button>
              ))}
            </div>
          </div>

          {/* Totals — the receipt-style summary */}
          <div className="space-y-1 rounded-2xl bg-violet-50/80 p-3 md:p-2.5 dark:bg-violet-500/10">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('subtotal')}</span>
              <span className="font-medium tabular-nums text-foreground">{formatCurrency(cart.subtotal)}</span>
            </div>
            {cart.discount > 0 && (
              <div className="flex justify-between text-xs font-medium text-rose-600 dark:text-rose-400">
                <span>{t('discount')}</span>
                <span className="tabular-nums">-{formatCurrency(cart.discount)}</span>
              </div>
            )}
            {cart.taxActive && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('tax')}</span>
                <span className="font-medium tabular-nums text-foreground">{formatCurrency(cart.tax)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-dashed border-violet-300/60 pt-2 dark:border-violet-400/30">
              <span className="text-sm font-semibold">{t('total')}</span>
              <span className="text-xl font-extrabold tabular-nums text-violet-700 md:text-lg dark:text-violet-300">
                {formatCurrency(cart.total)}
              </span>
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t('paymentMethod')}</span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'cash', label: t('cash'), icon: Wallet },
                { key: 'card', label: t('card'), icon: CreditCard },
                { key: 'transfer', label: t('transfer'), icon: ArrowRightLeft },
                { key: 'debt', label: t('debt'), icon: AlertTriangle },
              ].map((pm) => {
                const Icon = pm.icon
                const isSelected = paymentMethod === pm.key
                return (
                  <button
                    key={pm.key}
                    type="button"
                    onClick={() => onPaymentMethodChange(pm.key as PosPaymentMethod)}
                    title={pm.label}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border text-[11px] font-semibold transition-all duration-150 active:scale-95 md:h-12 md:gap-1',
                      isSelected
                        ? 'border-transparent bg-brand-gradient text-white shadow-brand'
                        : 'border-border bg-background text-muted-foreground hover:border-violet-300 hover:text-violet-700 dark:hover:text-violet-300'
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span className="max-w-full truncate px-0.5 leading-none">{pm.label}</span>
                  </button>
                )
              })}
            </div>
            {paymentMethod === 'debt' && !selectedCustomer && (
              <p className="flex items-center gap-1 pt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {t('debtNeedsCustomer')}
              </p>
            )}
          </div>

          {/* Pinned to the bottom: the pay button is always in reach, however tall the rest is. */}
          <div className="sticky bottom-0 z-10 -mx-3 -mb-3 border-t border-border/60 bg-card/95 p-3 backdrop-blur">
            <Button
              onClick={onCheckout}
              disabled={cart.items.length === 0 || isCheckingOut || (paymentMethod === 'debt' && !selectedCustomer)}
              className="h-14 w-full cursor-pointer gap-2 rounded-2xl text-base font-bold md:h-12 md:text-sm"
            >
              {isCheckingOut ? tCommon('saving') : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  {t('checkout')}
                  {sheet && <span className="tabular-nums">· {formatCurrency(cart.total)}</span>}
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
