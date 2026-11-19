'use client'

import { ArrowLeftRight, Coins, CreditCard, Edit2, Minus, Plus, Trash2, Wallet, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useCan } from '@/components/providers/permissions-provider'
import { cn } from '@/lib/utils'
import type { Cashbox, CashboxType, MovementType } from './cashbox-types'

export const CASHBOX_TYPE_META: Record<CashboxType, { icon: LucideIcon; labelKey: string }> = {
  cash: { icon: Coins, labelKey: 'finance.cashboxTypeCash' },
  card: { icon: CreditCard, labelKey: 'finance.cashboxTypeCard' },
  transfer: { icon: ArrowLeftRight, labelKey: 'finance.cashboxTypeTransfer' },
  other: { icon: Wallet, labelKey: 'finance.cashboxTypeOther' },
}

export const typeMetaOf = (cashbox: Cashbox) => CASHBOX_TYPE_META[cashbox.type] ?? CASHBOX_TYPE_META.cash

export interface CashboxRowActions {
  onMove: (cashbox: Cashbox, type: MovementType) => void
  onEdit: (cashbox: Cashbox) => void
  onDelete: (cashbox: Cashbox) => void
}

const MOVE_TONE: Record<MovementType, string> = {
  income:
    'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60',
  expense:
    'border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60',
}

interface MoveButtonProps {
  cashbox: Cashbox
  type: MovementType
  onMove: CashboxRowActions['onMove']
  className?: string
}

export function MoveButton({ cashbox, type, onMove, className }: MoveButtonProps) {
  const t = useTranslations('finance')
  const Icon = type === 'income' ? Plus : Minus
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => onMove(cashbox, type)}
      className={cn('font-semibold', MOVE_TONE[type], className)}
    >
      <Icon className="size-3.5" />
      {t(type === 'income' ? 'cashIn' : 'cashOut')}
    </Button>
  )
}

interface ManageButtonsProps extends Pick<CashboxRowActions, 'onEdit' | 'onDelete'> {
  cashbox: Cashbox
  buttonClassName?: string
}

export function ManageButtons({ cashbox, onEdit, onDelete, buttonClassName }: ManageButtonsProps) {
  const tCommon = useTranslations('common')
  const canEdit = useCan('finance', 'edit', 'cashbox')
  const canDelete = useCan('finance', 'delete', 'cashbox')
  return (
    <>
      {canEdit && (
        <Button type="button" variant="ghost" size="icon" aria-label={tCommon('edit')} onClick={() => onEdit(cashbox)} className={buttonClassName}>
          <Edit2 className="size-4" />
        </Button>
      )}
      {canDelete && (
        <Button type="button" variant="ghost" size="icon" aria-label={tCommon('delete')} onClick={() => onDelete(cashbox)} className={buttonClassName}>
          <Trash2 className="size-4" />
        </Button>
      )}
    </>
  )
}
