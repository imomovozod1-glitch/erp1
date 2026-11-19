'use client'

import { useEffect, useEffectEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import type { CashboxTransactionForm } from './cashbox-movement'
import { isMainCashbox, type Cashbox, type CashboxPageData, type MovementType } from './cashbox-types'

type OpenMovement = (cashbox: Cashbox, type: MovementType, preset: Partial<CashboxTransactionForm>) => void

function deepLinkTarget(params: URLSearchParams, { cashboxes, categories }: CashboxPageData) {
  const action = params.get('action')
  if ((action !== 'kirim' && action !== 'chiqim') || !cashboxes.length || !categories.length) return null
  const type: MovementType = action === 'kirim' ? 'income' : 'expense'
  const collectsDebt = params.get('type') === 'debt_collection'
  const category = collectsDebt
    ? categories.find((c) => c.type === 'income' && c.person_type === 'customer')
    : categories.find((c) => c.type === type)
  return {
    cashbox: cashboxes.find(isMainCashbox) ?? cashboxes[0],
    type,
    preset: { categoryId: category?.id ?? '', customerId: collectsDebt ? (params.get('customerId') ?? '') : '' },
  }
}

export function useMovementDeepLink(snapshot: CashboxPageData, openMovement: OpenMovement) {
  const searchParams = useSearchParams()
  const open = useEffectEvent((target: NonNullable<ReturnType<typeof deepLinkTarget>>) => {
    openMovement(target.cashbox, target.type, target.preset)
    window.history.replaceState({}, '', window.location.pathname)
  })

  useEffect(() => {
    const target = deepLinkTarget(searchParams, snapshot)
    if (!target) return
    const timer = setTimeout(() => open(target), 0)
    return () => clearTimeout(timer)
  }, [searchParams, snapshot])
}
