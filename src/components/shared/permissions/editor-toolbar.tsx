'use client'

import { ChevronsDownUp, ChevronsUpDown, Info, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePermissionLabels } from './use-permission-labels'

interface EditorToolbarProps {
  allOpen: boolean
  onToggleAll: () => void
  onGrantEverything: (on: boolean) => void
  disabled?: boolean
}

export function EditorToolbar({ allOpen, onToggleAll, onGrantEverything, disabled }: EditorToolbarProps) {
  const { t } = usePermissionLabels()
  const ExpandIcon = allOpen ? ChevronsDownUp : ChevronsUpDown
  const expandLabel = t(allOpen ? 'permissions.collapseAll' : 'permissions.expandAll')
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-violet-200/70 bg-brand-subtle p-3 sm:flex-row sm:items-center sm:justify-between dark:border-violet-900/50">
      <p className="flex items-start gap-2 text-sm text-violet-900 dark:text-violet-100">
        <Info className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-300" />
        {t('permissions.simpleHint')}
      </p>
      <div className="flex gap-2 sm:shrink-0">
        <Button type="button" variant="ghost" size="sm" onClick={onToggleAll} aria-label={expandLabel} className="max-sm:order-last">
          <ExpandIcon className="size-4" />
          <span className="max-sm:sr-only">{expandLabel}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onGrantEverything(true)}
          className="max-sm:flex-1"
        >
          <ShieldCheck className="size-4" />
          {t('permissions.grantAll')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onGrantEverything(false)}
          className="max-sm:flex-1"
        >
          <ShieldOff className="size-4" />
          {t('permissions.clearAll')}
        </Button>
      </div>
    </div>
  )
}
