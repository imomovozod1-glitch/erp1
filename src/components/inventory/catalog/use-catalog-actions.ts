'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'
import { invalidateProducts } from '@/lib/data/revalidate'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import type { CatalogItem, CatalogKind } from './catalog-types'

const FOREIGN_KEY_VIOLATION = '23503'

const ARCHIVED_MESSAGE: Record<CatalogKind, string> = {
  products: 'inventory.productDeactivatedInsteadOfDeleted',
  services: 'inventory.serviceDeactivatedInsteadOfDeleted',
}

async function setActive(id: string, active: boolean) {
  const { error } = await (createClient() as any).from('products').update({ is_active: active }).eq('id', id)
  if (error) throw error
}

async function deleteOrArchive(id: string): Promise<'deleted' | 'archived'> {
  const { error } = await (createClient() as any).from('products').delete().eq('id', id)
  if (!error) return 'deleted'
  if (error.code !== FOREIGN_KEY_VIOLATION) throw error
  await setActive(id, false)
  return 'archived'
}

export function useCatalogActions(kind: CatalogKind) {
  const t = useTranslations()
  const [confirmDelete, confirmDialog] = useConfirmDelete()
  const [busyId, setBusyId] = useState<string | null>(null)

  const run = async (item: CatalogItem, action: () => Promise<string>) => {
    setBusyId(item.id)
    try {
      toast.success(t(await action()))
      await invalidateProducts()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      setBusyId(null)
    }
  }

  const toggleStatus = (item: CatalogItem) =>
    run(item, async () => {
      await setActive(item.id, !item.is_active)
      return 'common.success'
    })

  const remove = async (item: CatalogItem) => {
    if (kind === 'products' && Number(item.stock) > 0) return void toast.error(t('inventory.cannotDeleteWithStock'))
    if (!(await confirmDelete({ name: item.name }))) return
    await run(item, async () => ((await deleteOrArchive(item.id)) === 'archived' ? ARCHIVED_MESSAGE[kind] : 'common.success'))
  }

  return { busyId, toggleStatus, remove, confirmDialog }
}

export type CatalogActions = ReturnType<typeof useCatalogActions>
