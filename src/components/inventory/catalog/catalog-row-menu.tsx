'use client'

import Link from 'next/link'
import { MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCan } from '@/components/providers/permissions-provider'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  if (!canEdit && !canDelete) return null

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              aria-label={t('actions')}
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent side="left">{t('actions')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-40">
        {canEdit && (
          <DropdownMenuItem render={<Link href={catalogHref(lang, kind, item.id, true)} prefetch />}>
            <Pencil className="mr-2 size-3.5" /> {t('edit')}
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem onClick={() => actions.toggleStatus(item)} disabled={busy}>
            <Power className="mr-2 size-3.5" /> {t(item.is_active ? 'inactive' : 'active')}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            onClick={() => actions.remove(item)}
            disabled={busy}
            className="text-rose-600 focus:bg-rose-50 focus:text-rose-600 dark:focus:bg-rose-950/30"
          >
            <Trash2 className="mr-2 size-3.5" /> {t('delete')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
