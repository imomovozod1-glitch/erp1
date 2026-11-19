'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'
import { invalidateCashbox, invalidateTransactions } from '@/lib/data/revalidate'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { writeMirror } from './cashbox-mirror'
import { saveCashboxOffline, saveCashboxOnline } from './cashbox-save'
import type { CashboxFormValues } from './cashbox-form-dialog'
import type { Cashbox, CashboxPageData } from './cashbox-types'
import { failureMessage } from './failure-message'

interface EditorDeps {
  supabase: any
  snapshot: CashboxPageData
  replaceLists: (lists: { cashboxes: Cashbox[]; transactions: any[] }) => void
}

export function useCashboxEditor({ supabase, snapshot, replaceLists }: EditorDeps) {
  const tRoot = useTranslations()
  const [confirmDelete, confirmDialog] = useConfirmDelete()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Cashbox | null>(null)
  const [saving, setSaving] = useState(false)
  const { cashboxes, transactions, failed: offline } = snapshot

  const openFor = (cashbox: Cashbox | null) => {
    setEditing(cashbox)
    setOpen(true)
  }

  const persist = async (values: CashboxFormValues) => {
    const context = { values, editing, openingLabel: tRoot('finance.initialBalance') }
    if (!offline) {
      await saveCashboxOnline(supabase, context)
      if (!editing && values.initialBalance > 0) await invalidateTransactions()
      return invalidateCashbox()
    }
    const next = saveCashboxOffline(context, cashboxes, transactions)
    replaceLists(next)
    if (next.opened) await invalidateTransactions()
  }

  const save = async (values: CashboxFormValues) => {
    if (saving) return
    if (!values.name) return void toast.error(tRoot('common.required'))
    setSaving(true)
    try {
      await persist(values)
      toast.success(tRoot('common.success'))
      setOpen(false)
    } catch (error) {
      toast.error(failureMessage(tRoot, error, tRoot('common.error')))
    } finally {
      setSaving(false)
    }
  }

  const removeOffline = (id: string) => {
    const next = cashboxes.filter((cb) => cb.id !== id)
    writeMirror('erp_cashboxes', next)
    replaceLists({ cashboxes: next, transactions })
  }

  const removeOnline = async (id: string) => {
    const { error } = await supabase.from('cashboxes').delete().eq('id', id)
    if (error) throw error
    await invalidateCashbox()
  }

  const remove = async (cashbox: Cashbox) => {
    if (cashbox.balance > 0) return void toast.error(tRoot('finance.cannotDeleteNonEmptyCashbox'))
    if (!(await confirmDelete({ name: cashbox.name }))) return
    try {
      await (offline ? removeOffline(cashbox.id) : removeOnline(cashbox.id))
      toast.success(tRoot('common.success'))
    } catch (error) {
      toast.error(errorMessage(tRoot, error, tRoot('common.error')))
    }
  }

  return { open, setOpen, editing, saving, openFor, save, remove, confirmDialog }
}
