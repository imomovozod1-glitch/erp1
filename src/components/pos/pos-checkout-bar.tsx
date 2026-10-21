'use client'

import { ShoppingBag } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/utils'

/**
 * Phones only: the "Savat" button. It floats where every page's primary action
 * ("+ Yangi sotuv" …, see PageHeader) floats, and opens everything in the
 * basket the way that button opens its form — as a bottom sheet. It is always
 * there, empty basket included, so the cashier never hunts for it; the count
 * and the running total ride on it once there is something to pay for.
 * On desktop the basket is always on screen beside the products.
 */
export function PosCheckoutBar({ count, total, onOpen }: { count: number; total: number; onOpen: () => void }) {
  const t = useTranslations('pos')

  return (
    <button
      type="button"
      onClick={onOpen}
      className="no-print fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex h-12 cursor-pointer items-center gap-2 rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white shadow-brand-lg transition-transform active:scale-95 md:hidden"
    >
      <span className="relative flex">
        <ShoppingBag className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-2 -right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-violet-700 tabular-nums">
            {count}
          </span>
        )}
      </span>
      {t('cart')}
      {count > 0 && <span className="tabular-nums opacity-90">· {formatCurrency(total)}</span>}
    </button>
  )
}
