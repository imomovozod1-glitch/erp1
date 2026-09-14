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
import { formatCurrency } from '@/lib/utils'
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
  lang,
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
}) {
  const tCommon = useTranslations('common')
  const t = useTranslations('pos')

  return (
    <div className="md:col-span-1 md:h-full md:flex md:flex-col md:min-h-0 overflow-hidden">
      <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white pt-0 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Cart Header */}
        <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <ShoppingBag className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('cart')}</CardTitle>
              <span className="mt-0.5 block text-xs tabular-nums text-slate-400 dark:text-slate-500">
                {cart.items.length} {tCommon('rows')}
              </span>
            </div>
          </div>
          {cart.items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-8 cursor-pointer rounded-lg px-2.5 text-xs text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
            >
              {tCommon('clear')}
            </Button>
          )}
        </CardHeader>

        {/* Cart Items — reserved for at least 3 cards before this ever needs to scroll */}
        <div className="flex-1 min-h-58 overflow-y-auto scrollbar-thin p-3 space-y-2">
          {cart.items.length === 0 ? (
            <div className="h-full min-h-52 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
              <div className="rounded-full border-2 border-dashed border-slate-200 p-5 dark:border-slate-700">
                <ShoppingBag className="h-7 w-7 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('emptyCart')}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {lang === 'uz' ? "Mahsulotni bosing yoki SKU'ni skanerlang" : lang === 'ru' ? 'Нажмите на товар или отсканируйте SKU' : 'Click a product or scan its SKU'}
                </p>
              </div>
            </div>
          ) : (
            cart.items.map((item) => {
              const finalPrice = item.product.price * (1 - item.discountPercent / 100)
              return (
                <div
                  key={item.product.id}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                >
                  <div className="flex items-start gap-2.5">
                    {/* The same picture the cashier just tapped. Without it a
                        cart of similar names ("Coca-Cola 0.5" / "Coca-Cola 1.0")
                        can only be checked by reading, which is exactly what
                        the product grid uses photos to avoid. */}
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60">
                      {item.product.image_url ? (
                        <Image
                          src={item.product.image_url}
                          alt={item.product.name}
                          fill
                          sizes="44px"
                          className="object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
                          <Package className="h-4.5 w-4.5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium leading-tight text-slate-800 dark:text-slate-200">
                            {item.product.name}
                          </p>
                          <p className="mt-0.5 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                            {formatCurrency(item.product.price)}
                            {item.discountPercent > 0 && (
                              <span className="ml-1 font-medium text-rose-500 dark:text-rose-400">
                                −{item.discountPercent}%
                              </span>
                            )}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cart.remove(item.product.id)}
                          className="h-7 w-7 shrink-0 cursor-pointer rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 mt-2">
                        {/* Quantity picker */}
                        <div className="flex h-8 shrink-0 items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                          <button
                            type="button"
                            onClick={() => cart.setQuantity(item.product.id, item.quantity - 1)}
                            className="h-full border-r border-slate-200 px-2.5 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <NumericInput
                            value={item.quantity === 0 ? '' : item.quantity}
                            // Typed, not stepped: `setTypedQuantity` keeps the
                            // line alive through "0" and "0." on the way to a
                            // fractional quantity.
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
                            className="h-full w-11 rounded-none border-0 p-0 text-center text-[13px] font-semibold tabular-nums text-slate-800 shadow-none focus:bg-slate-50 focus:outline-none dark:text-slate-200 dark:focus:bg-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => cart.setQuantity(item.product.id, item.quantity + 1)}
                            className="h-full border-l border-slate-200 px-2.5 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Item discount input */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Percent className="h-3 w-3 text-slate-400" />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent || ''}
                            onChange={(e) => cart.setLineDiscount(item.product.id, Number(e.target.value))}
                            placeholder="0"
                            className="h-8 w-10 rounded-lg border border-slate-200 bg-white p-1 text-center text-xs tabular-nums text-slate-800 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>

                        <p className="ml-auto truncate text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {formatCurrency(finalPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Checkout Totals & Settings — compact "options" style footer, fixed, never scrolls or shrinks */}
        <div className="shrink-0 space-y-2.5 border-t border-slate-200 p-3 dark:border-slate-800">
          {/* Linked Customer Selection — select + add button on one row, no separate label line */}
          <div className="flex items-center gap-1.5">
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
              <SelectTrigger className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <SelectValue placeholder={t('walkInCustomer')}>
                  {selectedCustomer
                    ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
                    : t('walkInCustomer')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
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
              className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border-slate-200 p-0 text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-violet-950/30 dark:hover:text-violet-400"
            >
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* General Discount — inline label, no separate row */}
          <div className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('generalDiscount')}
            </span>
            <Input
              type="number"
              min="0"
              value={cart.generalDiscountValue || ''}
              onChange={(e) => cart.setGeneralDiscountValue(Number(e.target.value))}
              placeholder="0"
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white text-xs tabular-nums text-slate-800 transition-colors focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => cart.setGeneralDiscountType(cart.generalDiscountType === 'flat' ? 'percent' : 'flat')}
              className="h-9 shrink-0 cursor-pointer rounded-lg border-0 bg-slate-100 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {cart.generalDiscountType === 'percent' ? '%' : 'so\'m'}
            </Button>
          </div>

          {/* Totals Breakdown — receipt-style summary card */}
          <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{t('subtotal')}</span>
              <span className="font-medium tabular-nums text-slate-600 dark:text-slate-300">{formatCurrency(cart.subtotal)}</span>
            </div>
            {cart.discount > 0 && (
              <div className="flex justify-between text-xs font-medium text-rose-600 dark:text-rose-400">
                <span>{t('discount')}</span>
                <span className="tabular-nums">-{formatCurrency(cart.discount)}</span>
              </div>
            )}
            {cart.taxActive && (
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{t('tax')}</span>
                <span className="font-medium tabular-nums text-slate-600 dark:text-slate-300">{formatCurrency(cart.tax)}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between border-t border-dashed border-slate-200 pt-1.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <span>{t('total')}</span>
              <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(cart.total)}</span>
            </div>
          </div>

          {/* Payment Method — minimal segmented control */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('paymentMethod')}</span>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {[
                { key: 'cash', label: t('cash'), icon: Wallet },
                { key: 'card', label: t('card'), icon: CreditCard },
                { key: 'transfer', label: t('transfer'), icon: ArrowRightLeft },
                { key: 'debt', label: t('debt'), icon: AlertTriangle }
              ].map((pm) => {
                const Icon = pm.icon
                const isSelected = paymentMethod === pm.key
                return (
                  <button
                    key={pm.key}
                    type="button"
                    onClick={() => onPaymentMethodChange(pm.key as any)}
                    title={pm.label}
                    className={`flex h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors duration-150 ${
                      isSelected
                        ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="max-w-full truncate px-0.5 leading-none">{pm.label}</span>
                  </button>
                )
              })}
            </div>
            {paymentMethod === 'debt' && !selectedCustomer && (
              <p className="flex items-center gap-1 pt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {lang === 'uz' ? "Noma'lum mijozga qarzga sotib bo'lmaydi — mijozni tanlang" : lang === 'ru' ? 'Нельзя продать в долг неизвестному клиенту — выберите клиента' : "Can't sell on credit to an unknown customer — select a customer"}
              </p>
            )}
          </div>

          {/* Checkout Button */}
          <Button
            onClick={onCheckout}
            disabled={cart.items.length === 0 || isCheckingOut || (paymentMethod === 'debt' && !selectedCustomer)}
            className="h-12 w-full cursor-pointer gap-2 rounded-lg border-0 bg-violet-600 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-violet-700 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          >
            {isCheckingOut ? tCommon('saving') : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {t('checkout')}
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
