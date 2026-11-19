'use client'

import { AlertTriangle, ArrowRightLeft, CreditCard, Wallet, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from './sale-lines'

const METHODS: { key: PaymentMethod; icon: LucideIcon }[] = [
  { key: 'cash', icon: Wallet },
  { key: 'card', icon: CreditCard },
  { key: 'transfer', icon: ArrowRightLeft },
  { key: 'debt', icon: AlertTriangle },
]

const tone = (method: PaymentMethod, selected: boolean) => {
  if (!selected) return 'border-border bg-card text-muted-foreground hover:bg-muted/60'
  return method === 'debt'
    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
    : 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400'
}

interface PaymentMethodPickerProps {
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
}

export function PaymentMethodPicker({ value, onChange }: PaymentMethodPickerProps) {
  const t = useTranslations('pos')
  return (
    <div role="radiogroup" className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
      {METHODS.map(({ key, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={cn('flex h-10 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-all', tone(key, value === key))}
        >
          <Icon className="size-3.5" />
          {t(key)}
        </button>
      ))}
    </div>
  )
}
