'use client'

import { cn } from '@/lib/utils'
import type { LevelAction } from '@/lib/permissions'
import { ACTIONS } from './permission-model'
import type { ModuleModel, SectionModel } from './editor-model'
import { ActionCheckbox, ScopeControl, SectionTitle } from './section-parts'
import { usePermissionLabels } from './use-permission-labels'

interface SectionTableProps {
  module: ModuleModel
  disabled?: boolean
}

export function SectionTable({ module, disabled }: SectionTableProps) {
  const hasScope = module.sections.some((section) => section.resource.ownable)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <SectionTableHead hasScope={hasScope} />
        <tbody className="divide-y divide-border/60">
          {module.sections.map((section) => (
            <SectionRow key={section.resource.key} section={section} hasScope={hasScope} disabled={disabled} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionTableHead({ hasScope }: { hasScope: boolean }) {
  const { t, actionName } = usePermissionLabels()
  return (
    <thead>
      <tr className="bg-muted/40 text-xs text-muted-foreground">
        <th className="px-4 py-2.5 text-left font-semibold">{t('permissions.section')}</th>
        {ACTIONS.map((action) => (
          <th key={action} className="w-24 px-2 py-2.5 text-center font-semibold">
            {actionName(action)}
          </th>
        ))}
        {hasScope && (
          <th className="w-64 px-3 py-2.5 text-left font-semibold" title={t('permissions.recordsHint')}>
            {t('permissions.recordsTitle')}
          </th>
        )}
      </tr>
    </thead>
  )
}

interface SectionRowProps {
  section: SectionModel
  hasScope: boolean
  disabled?: boolean
}

function SectionRow({ section, hasScope, disabled }: SectionRowProps) {
  const active = section.tick !== 'none'
  return (
    <tr className={cn('transition-colors', active ? 'bg-violet-50/40 dark:bg-violet-950/10' : 'hover:bg-muted/30')}>
      <td className="px-4 py-2.5">
        <SectionTitle section={section} disabled={disabled} />
      </td>
      {ACTIONS.map((action) => (
        <td key={action} className="px-2 py-2.5 text-center">
          <ActionCell section={section} action={action} disabled={disabled} />
        </td>
      ))}
      {hasScope && (
        <td className="px-3 py-2">
          <ScopeControl section={section} disabled={disabled} />
        </td>
      )}
    </tr>
  )
}

function ActionCell({ section, action, disabled }: { section: SectionModel; action: LevelAction; disabled?: boolean }) {
  if (!section.resource.actions.includes(action)) {
    return <span aria-hidden className="text-muted-foreground/40">—</span>
  }
  return (
    <span className="inline-flex">
      <ActionCheckbox section={section} action={action} disabled={disabled} />
    </span>
  )
}
