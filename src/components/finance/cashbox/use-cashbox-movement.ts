'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { formatCurrency, isoDate } from '@/lib/utils'
import { invalidateCashboxMovement } from '@/lib/data/revalidate'
import { fireTelegramNotification } from '@/lib/integrations/notify-client'
import {
  buildMovement,
  debtSettlement,
  emptyTransactionForm,
  keepPersonOnly,
  movementProblem,
  type CashboxTransactionForm,
  type MovementProblem,
} from './cashbox-movement'
import { recordMovementOnline, type SettleInput } from './cashbox-operations'
import { recordMovementOffline } from './cashbox-operations-offline'
import type { Cashbox, CashboxPageData, MovementType, NamedRow, PersonType } from './cashbox-types'
import { failureMessage } from './failure-message'
import { useCashboxDebts } from './use-cashbox-debts'

interface MovementDeps {
  supabase: any
  snapshot: CashboxPageData
  replaceLists: (lists: { cashboxes: Cashbox[]; transactions: any[] }) => void
}

const PERSON_LABEL: Record<Exclude<PersonType, 'none'>, string> = {
  employee: 'finance.personTypeEmployee',
  supplier: 'finance.personTypeSupplier',
  customer: 'finance.personTypeCustomer',
}

export function useCashboxMovement({ supabase, snapshot, replaceLists }: MovementDeps) {
  const tRoot = useTranslations()
  const debts = useCashboxDebts(supabase, snapshot.failed)
  const [cashbox, setCashbox] = useState<Cashbox | null>(null)
  const [form, setForm] = useState<CashboxTransactionForm>(emptyTransactionForm)
  const [saving, setSaving] = useState(false)
  const category = snapshot.categories.find((c) => c.id === form.categoryId)

  const patchForm = (patch: Partial<CashboxTransactionForm>) => setForm((current) => ({ ...current, ...patch }))

  const openFor = (target: Cashbox, type: MovementType, preset: Partial<CashboxTransactionForm> = {}) => {
    const categoryId = snapshot.categories.find((c) => c.type === type)?.id ?? ''
    setCashbox(target)
    setForm({ ...emptyTransactionForm, type, categoryId, date: isoDate(), ...preset })
    debts.reset()
    if (preset.customerId) debts.selectCustomer(preset.customerId)
  }

  const chooseCategory = (categoryId: string) => {
    const personType = snapshot.categories.find((c) => c.id === categoryId)?.person_type ?? 'none'
    patchForm({ categoryId, ...keepPersonOnly(form, personType) })
    if (personType !== 'customer') debts.selectCustomer('')
    if (personType !== 'supplier') debts.selectSupplier('')
  }

  const choosePerson = (personType: Exclude<PersonType, 'none'>, id: string) => {
    patchForm({ [`${personType}Id`]: id })
    if (personType === 'customer') debts.selectCustomer(id)
    if (personType === 'supplier') debts.selectSupplier(form.type === 'expense' ? id : '')
  }

  const problemText = (problem: MovementProblem) => {
    if (problem.key === 'required') return tRoot('common.required')
    if (problem.key === 'insufficient')
      return tRoot('finance.insufficientFundsOnly', { amount: formatCurrency(problem.balance) })
    return tRoot(`finance.${problem.key}`)
  }

  const peopleOf = (personType: PersonType): NamedRow[] =>
    personType === 'none' ? [] : snapshot[`${personType}s` as 'customers' | 'employees' | 'suppliers']

  const movementFor = (target: Cashbox, chosen: NonNullable<typeof category>) => {
    const personType = chosen.person_type
    const personId = personType === 'none' ? '' : form[`${personType}Id` as const]
    return buildMovement({
      cashbox: target,
      form,
      category: chosen,
      person: peopleOf(personType).find((p) => p.id === personId),
      personLabel: personType === 'none' ? '' : tRoot(PERSON_LABEL[personType]),
    })
  }

  const recordOnline = async (movement: ReturnType<typeof movementFor>, settle: SettleInput | null) => {
    const { data } = await supabase.auth.getUser()
    if (!data?.user?.id) return void toast.error(tRoot('common.sessionNotFound'))
    await recordMovementOnline({ supabase, userId: data.user.id, movement, settle })
    return true
  }

  const notifyDebtPayment = (settle: SettleInput) =>
    fireTelegramNotification({
      event: 'debt_payment',
      data: {
        customerName: snapshot.customers.find((c) => c.id === settle.customerId)?.name ?? '—',
        amount: settle.amount,
      },
    })

  const commit = async (target: Cashbox, chosen: NonNullable<typeof category>) => {
    const movement = movementFor(target, chosen)
    const settle = debtSettlement(form, chosen)
    if (snapshot.failed) {
      replaceLists(recordMovementOffline(movement, settle, snapshot))
      return true
    }
    if (!(await recordOnline(movement, settle))) return false
    await invalidateCashboxMovement()
    if (settle) notifyDebtPayment(settle)
    return true
  }

  const submit = async () => {
    if (saving || !cashbox) return
    const problem = movementProblem(form, cashbox.balance, category)
    if (problem || !category) return void toast.error(problemText(problem ?? { key: 'required' }))
    setSaving(true)
    try {
      if (!(await commit(cashbox, category))) return
      toast.success(tRoot('common.success'))
      setCashbox(null)
    } catch (error) {
      toast.error(failureMessage(tRoot, error, tRoot('common.error')))
    } finally {
      setSaving(false)
    }
  }

  return {
    cashbox,
    setCashbox,
    form,
    category,
    patchForm,
    chooseCategory,
    choosePerson,
    saving,
    debts,
    openFor,
    close: () => setCashbox(null),
    submit,
  }
}

export type CashboxMovement = ReturnType<typeof useCashboxMovement>
