'use client'

import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Landmark, NotebookPen, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { NameSelect } from '@/components/shared/name-select'
import { cn, formatCurrency } from '@/lib/utils'
import type { PosPaymentMethod } from '@/components/pos/checkout'
import type { PosCart } from '@/components/pos/use-pos-cart'
import type { PosSale } from '@/components/pos/use-pos-sale'

// Icons only, each read at a glance: banknotes, a card, a bank, the debt ledger. The name stays in the tooltip.
const PAYMENT_METHODS = [
  { key: 'cash', icon: Banknote },
  { key: 'card', icon: CreditCard },
  { key: 'transfer', icon: Landmark },
  { key: 'debt', icon: NotebookPen },
] as const

const customerLabel = (c: any) => (c.phone ? `${c.name} (${c.phone})` : c.name)

export function CustomerPicker({ sale, onAdd }: { sale: PosSale; onAdd: () => void }) {
  const t = useTranslations('pos')
  const options = sale.customers.map((c) => ({ id: c.id, name: customerLabel(c) }))
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <NameSelect
          value={sale.customer?.id ?? ''}
          onChange={sale.chooseCustomer}
          options={options}
          placeholder={t('walkInCustomer')}
          clearLabel={t('walkInCustomer')}
          triggerClassName="h-11 text-xs md:h-10"
        />
      </div>
      <Button type="button" variant="outline" onClick={onAdd} title={t('addCustomer')} aria-label={t('addCustomer')} className="size-11 shrink-0 rounded-xl p-0 md:size-10">
        <UserPlus className="size-4" />
      </Button>
    </div>
  )
}

export function GeneralDiscount({ cart }: { cart: PosCart }) {
  const t = useTranslations('pos')
  return (
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
      <SegmentedControl
        label={t('generalDiscount')}
        value={cart.generalDiscountType}
        onChange={cart.setGeneralDiscountType}
        options={[{ value: 'flat', label: "so'm" }, { value: 'percent', label: '%' }]}
        className="shrink-0"
      />
    </div>
  )
}

function TotalRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex justify-between text-xs text-muted-foreground', className)}>
      <span>{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

export function SaleTotals({ cart }: { cart: PosCart }) {
  const t = useTranslations('pos')
  return (
    <div className="space-y-1 rounded-2xl bg-violet-50/80 p-3 md:p-2.5 dark:bg-violet-500/10">
      <TotalRow label={t('subtotal')} value={formatCurrency(cart.subtotal)} className="[&>span:last-child]:text-foreground" />
      {cart.discount > 0 && <TotalRow label={t('discount')} value={`-${formatCurrency(cart.discount)}`} className="text-rose-600 dark:text-rose-400" />}
      {cart.taxActive && <TotalRow label={t('tax')} value={formatCurrency(cart.tax)} className="[&>span:last-child]:text-foreground" />}
      <div className="flex items-center justify-between border-t border-dashed border-violet-300/60 pt-2 dark:border-violet-400/30">
        <span className="text-sm font-semibold">{t('total')}</span>
        <span className="text-xl font-extrabold text-violet-700 tabular-nums md:text-lg dark:text-violet-300">{formatCurrency(cart.total)}</span>
      </div>
    </div>
  )
}

export function PaymentMethods({ sale }: { sale: PosSale }) {
  const t = useTranslations('pos')
  return (
    <div className="space-y-1.5">
      {/* The buttons carry no words, so the chosen method is named here. */}
      <p className="text-xs font-medium text-muted-foreground">
        {t('paymentMethod')}: <span className="font-semibold text-violet-700 dark:text-violet-300">{t(sale.paymentMethod)}</span>
      </p>
      <div className="grid grid-cols-4 gap-2">
        {PAYMENT_METHODS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => sale.setPaymentMethod(key as PosPaymentMethod)}
            title={t(key)}
            aria-label={t(key)}
            aria-pressed={sale.paymentMethod === key}
            className={cn(
              'flex h-14 cursor-pointer items-center justify-center rounded-2xl border transition-all duration-150 active:scale-95 md:h-12',
              sale.paymentMethod === key
                ? 'border-transparent bg-brand-gradient text-white shadow-brand'
                : 'border-border bg-background text-muted-foreground hover:border-violet-300 hover:text-violet-700 dark:hover:text-violet-300'
            )}
          >
            <Icon className="size-6" strokeWidth={1.75} />
          </button>
        ))}
      </div>
      {sale.blocked && (
        <p className="flex items-center gap-1 pt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3 shrink-0" />
          {t('debtNeedsCustomer')}
        </p>
      )}
    </div>
  )
}

export function CheckoutButton({ cart, sale, sheet, onCheckout }: { cart: PosCart; sale: PosSale; sheet: boolean; onCheckout: () => void }) {
  const t = useTranslations('pos')
  return (
    <div className="sticky bottom-0 z-10 -mx-3 -mb-3 border-t border-border/60 bg-card/95 p-3 backdrop-blur">
      <Button onClick={onCheckout} disabled={cart.items.length === 0 || sale.blocked} className="h-14 w-full gap-2 rounded-2xl text-base font-bold md:h-12 md:text-sm">
        <CheckCircle2 className="size-5" />
        {t('checkout')}
        {sheet && <span className="tabular-nums">· {formatCurrency(cart.total)}</span>}
      </Button>
    </div>
  )
}
