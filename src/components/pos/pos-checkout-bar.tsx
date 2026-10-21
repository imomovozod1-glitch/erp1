'use client'

import { ArrowDown, ShoppingBag } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/utils'

/**
 * Phones only: while the basket has anything in it, a bar above the bottom
 * navigation says how much is in it and takes the cashier to the basket panel
 * (the customer, the payment method and the checkout button live there).
 * On desktop the basket is always on screen beside the products, so there is
 * nothing to point at.
 */
export function PosCheckoutBar({ count, total }: { count: number; total: number }) {
  const t = useTranslations('pos')
  if (count === 0) return null

  return (
    <div className="no-print fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 px-4 md:hidden">
      <button
        type="button"
        onClick={() => document.getElementById('pos-cart')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-[var(--chrome)] p-2 pl-3 text-left shadow-lg backdrop-blur-xl"
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
          <ShoppingBag className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-700 px-1 text-[11px] font-bold text-white dark:bg-violet-500">
            {count}
          </span>
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[11px] text-muted-foreground">{t('total')}</span>
          <span className="block truncate text-base font-extrabold tabular-nums text-violet-700 dark:text-violet-300">{formatCurrency(total)}</span>
        </span>
        <span className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-brand">
          {t('cart')}
          <ArrowDown className="h-4 w-4" />
        </span>
      </button>
    </div>
  )
}
