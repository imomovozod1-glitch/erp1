'use client'

import { Pencil, Power, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCan } from '@/components/providers/permissions-provider'
import { RowActionsMenu } from '@/components/shared/row-actions-menu'
import { catalogHref, type CatalogItem, type CatalogKind } from './catalog-types'
import type { CatalogActions } from './use-catalog-actions'

interface CatalogRowMenuProps {
  kind: CatalogKind
  item: CatalogItem
  lang: string
  actions: CatalogActions
}

export function CatalogRowMenu({ kind, item, lang, actions }: CatalogRowMenuProps) {
  const t = useTranslations('common')
  const canEdit = useCan('inventory', 'edit', kind)
  const canDelete = useCan('inventory', 'delete', kind)
  const busy = actions.busyId === item.id
  return (
    <RowActionsMenu
      actions={[
        { key: 'edit', label: t('edit'), icon: Pencil, href: catalogHref(lang, kind, item.id, true), hidden: !canEdit },
        { key: 'status', label: t(item.is_active ? 'inactive' : 'active'), icon: Power, onClick: () => actions.toggleStatus(item), disabled: busy, hidden: !canEdit },
        { key: 'delete', label: t('delete'), icon: Trash2, onClick: () => actions.remove(item), disabled: busy, destructive: true, hidden: !canDelete },
      ]}
    />
  )
}
