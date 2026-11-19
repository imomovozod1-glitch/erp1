'use client'

import Image from 'next/image'
import { Minus, Package, Percent, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { NumericInput } from '@/components/ui/numeric-input'
import { unitAllowsDecimals } from '@/lib/units'
import { cn, formatCurrency } from '@/lib/utils'
import { lineTotal } from '@/components/pos/pos-sale-model'
import type { CartItem, PosCart } from '@/components/pos/use-pos-cart'

interface LineProps {
  item: CartItem
  cart: PosCart
  sheet: boolean
}

// The same picture the cashier just tapped: a cart of near-identical names is checked by sight.
function LineThumb({ product }: { product: any }) {
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-violet-50 p-0.5 dark:bg-violet-500/10">
      {product.image_url ? (
        <Image src={product.image_url} alt={product.name} fill sizes="48px" className="object-contain" />
      ) : (
        <div className="flex size-full items-center justify-center text-violet-300 dark:text-violet-400/60">
          <Package className="size-5" />
        </div>
      )}
    </div>
  )
}

function QuantityStepper({ item, cart, sheet }: LineProps) {
  const id = item.product.id
  const step = cn(
    'flex items-center justify-center text-violet-700 transition-colors hover:bg-violet-100 active:bg-violet-200 dark:text-violet-300 dark:hover:bg-violet-500/20',
    sheet ? 'size-10' : 'size-8'
  )
  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded-full bg-violet-50 dark:bg-violet-500/10">
      <button type="button" aria-label="−" onClick={() => cart.setQuantity(id, item.quantity - 1)} className={step}>
        <Minus className="size-3.5" />
      </button>
      <NumericInput
        value={item.quantity === 0 ? '' : item.quantity}
        onChange={(value) => (value === '' ? cart.clearQuantity(id) : cart.setTypedQuantity(id, value))}
        allowDecimals={unitAllowsDecimals(item.product.unit)}
        onBlur={() => item.quantity <= 0 && cart.remove(id)}
        className={cn('rounded-none border-0 bg-transparent p-0 text-center text-sm font-bold tabular-nums shadow-none focus:outline-none', sheet ? 'h-10 w-12' : 'h-8 w-11')}
      />
      <button type="button" aria-label="+" onClick={() => cart.setQuantity(id, item.quantity + 1)} className={step}>
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

function LineDiscount({ item, cart, sheet }: LineProps) {
  return (
    <label
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20',
        sheet ? 'h-10' : 'h-8'
      )}
    >
      <Percent className="size-3 text-muted-foreground" />
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
  )
}

export function PosCartLine({ item, cart, sheet }: LineProps) {
  const t = useTranslations('common')
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-3 shadow-xs transition-colors hover:border-violet-300 dark:hover:border-violet-700">
      <div className="flex items-start gap-3">
        <LineThumb product={item.product} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] leading-tight font-semibold">{item.product.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {formatCurrency(item.product.price)}
            {item.discountPercent > 0 && <span className="ml-1 font-semibold text-rose-500 dark:text-rose-400">−{item.discountPercent}%</span>}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('delete')}
          onClick={() => cart.remove(item.product.id)}
          className={cn(
            'flex shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400',
            sheet ? 'size-9' : 'size-7'
          )}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <QuantityStepper item={item} cart={cart} sheet={sheet} />
        <LineDiscount item={item} cart={cart} sheet={sheet} />
        <p className="ml-auto truncate text-sm font-extrabold text-violet-700 tabular-nums dark:text-violet-300">{formatCurrency(lineTotal(item))}</p>
      </div>
    </div>
  )
}
