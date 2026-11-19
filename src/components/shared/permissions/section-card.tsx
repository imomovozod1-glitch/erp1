'use client'

import { cn } from '@/lib/utils'
import type { LevelAction } from '@/lib/permissions'
import { actionsOf } from './permission-model'
import type { SectionModel } from './editor-model'
import { ActionCheckbox, ScopeControl, SectionTitle, activeSurface } from './section-parts'
import { usePermissionLabels } from './use-permission-labels'

interface SectionCardProps {
  section: SectionModel
  disabled?: boolean
}

export function SectionCard({ section, disabled }: SectionCardProps) {
  const actions = actionsOf(section.resource)
  return (
    <div className={cn('space-y-3 rounded-2xl border p-3 transition-colors', activeSurface(section.tick))}>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle section={section} disabled={disabled} className="text-sm" />
        <CountPill on={section.ticked.size} total={actions.length} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <ActionChip key={action} section={section} action={action} disabled={disabled} />
        ))}
      </div>
      {section.resource.ownable && <ScopeField section={section} disabled={disabled} />}
    </div>
  )
}

function ActionChip({ section, action, disabled }: SectionCardProps & { action: LevelAction }) {
  const { actionName } = usePermissionLabels()
  const on = section.ticked.has(action)
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm font-medium transition-colors active:scale-[0.98]',
        on
          ? 'border-violet-300 bg-card text-violet-900 shadow-sm dark:border-violet-800 dark:text-violet-100'
          : 'border-border/60 bg-card/60 text-muted-foreground'
      )}
    >
      <ActionCheckbox section={section} action={action} disabled={disabled} />
      <span className="truncate">{actionName(action)}</span>
    </label>
  )
}

function ScopeField({ section, disabled }: SectionCardProps) {
  const { t } = usePermissionLabels()
  return (
    <div className="space-y-1.5 border-t border-border/60 pt-3">
      <p className="text-xs font-medium text-muted-foreground">{t('permissions.recordsTitle')}</p>
      <ScopeControl section={section} disabled={disabled} />
    </div>
  )
}

function CountPill({ on, total }: { on: number; total: number }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        on ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200' : 'bg-muted text-muted-foreground'
      )}
    >
      {on}/{total}
    </span>
  )
}
