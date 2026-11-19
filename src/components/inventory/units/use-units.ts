'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'
import { invalidateProducts } from '@/lib/data/revalidate'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'

export interface UnitRow {
  id: string
  name: string
}

const PAGE_SIZE = 10
const UNIQUE_VIOLATION = '23505'

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const byName = (a: UnitRow, b: UnitRow) => a.name.localeCompare(b.name)
const units = () => (createClient() as any).from('measurement_units')

export function useUnits(initialUnits: UnitRow[]) {
  const t = useTranslations()
  const [confirmDelete, confirmDialog] = useConfirmDelete()
  const [rows, setRows] = useState(initialUnits)
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)

  const taken = (name: string, exceptId?: string) => rows.some((u) => u.id !== exceptId && sameName(u.name, name))
  const failure = (error: any) =>
    toast.error(error?.code === UNIQUE_VIOLATION ? t('inventory.units.alreadyExists') : errorMessage(t, error, t('common.error')))

  const add = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    if (taken(trimmed)) {
      toast.error(t('inventory.units.alreadyExists'))
      return false
    }
    setAdding(true)
    try {
      const { data, error } = await units().insert({ name: trimmed }).select('id, name').single()
      if (error) {
        failure(error)
        return false
      }
      setRows((current) => [...current, data].sort(byName))
      toast.success(t('common.success'))
      return true
    } finally {
      setAdding(false)
    }
  }

  const rename = async (unit: UnitRow) => {
    const trimmed = editing?.value.trim() ?? ''
    if (!trimmed) return
    if (trimmed === unit.name) return setEditing(null)
    if (taken(trimmed, unit.id)) return void toast.error(t('inventory.units.alreadyExists'))
    const { error } = await units().update({ name: trimmed }).eq('id', unit.id)
    if (error) return void failure(error)
    setRows((current) => current.map((u) => (u.id === unit.id ? { ...u, name: trimmed } : u)).sort(byName))
    setEditing(null)
    toast.success(t('common.success'))
    await invalidateProducts()
  }

  const remove = async (unit: UnitRow) => {
    if (!(await confirmDelete({ name: unit.name }))) return
    const { error } = await units().delete().eq('id', unit.id)
    if (error) return void toast.error(errorMessage(t, error, t('common.error')))
    setRows((current) => current.filter((u) => u.id !== unit.id))
    toast.success(t('common.success'))
  }

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  return {
    rows,
    visible: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    offset: (page - 1) * PAGE_SIZE,
    page,
    totalPages,
    setPage,
    adding,
    editing,
    startEdit: (unit: UnitRow) => setEditing({ id: unit.id, value: unit.name }),
    changeEdit: (value: string) => setEditing((current) => current && { ...current, value }),
    cancelEdit: () => setEditing(null),
    add,
    rename,
    remove,
    confirmDialog,
  }
}

export type UnitsState = ReturnType<typeof useUnits>
