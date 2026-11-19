'use client'

import type { ComponentProps } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { cn } from '@/lib/utils'
import type { LevelAction } from '@/lib/permissions'
import { SCOPES, type Tick } from './permission-model'
import type { SectionModel } from './editor-model'
import { usePermissionLabels } from './use-permission-labels'

type TickCheckboxProps = Omit<ComponentProps<typeof Checkbox>, 'checked' | 'indeterminate' | 'onCheckedChange'> & {
  tick: Tick
  onChange: (on: boolean) => void
}

export function TickCheckbox({ tick, onChange, ...props }: TickCheckboxProps) {
  return (
    <Checkbox
      checked={tick === 'all'}
      indeterminate={tick === 'some'}
      onCheckedChange={() => onChange(tick !== 'all')}
      {...props}
    />
  )
}

interface SectionPartProps {
  section: SectionModel
  disabled?: boolean
}

export function SectionTitle({ section, disabled, className }: SectionPartProps & { className?: string }) {
  const { t, sectionName } = usePermissionLabels()
  const name = sectionName(section)
  return (
    <label className={cn('flex min-w-0 cursor-pointer items-center gap-3', className)}>
      <TickCheckbox
        size="lg"
        tick={section.tick}
        onChange={section.setAll}
        disabled={disabled}
        aria-label={`${name} — ${t('permissions.selectSection')}`}
      />
      <span className="truncate font-medium text-foreground">{name}</span>
    </label>
  )
}

export function ActionCheckbox({ section, action, disabled }: SectionPartProps & { action: LevelAction }) {
  const { sectionName, actionName } = usePermissionLabels()
  return (
    <Checkbox
      checked={section.ticked.has(action)}
      onCheckedChange={(on) => section.toggle(action, on)}
      disabled={disabled}
      aria-label={`${sectionName(section)} — ${actionName(action)}`}
    />
  )
}

export function ScopeControl({ section, disabled }: SectionPartProps) {
  const { t, sectionName, scopeName } = usePermissionLabels()
  if (!section.resource.ownable) {
    return <span className="text-xs text-muted-foreground">{t('permissions.records_all')}</span>
  }
  return (
    <SegmentedControl
      label={`${sectionName(section)} — ${t('permissions.recordsTitle')}`}
      value={section.scope}
      onChange={section.setScope}
      disabled={disabled || section.tick === 'none'}
      options={SCOPES.map((scope) => ({ value: scope, label: scopeName(scope) }))}
    />
  )
}

export function activeSurface(tick: Tick) {
  return tick === 'none'
    ? 'border-border/60 bg-muted/30'
    : 'border-violet-200 bg-violet-50/50 dark:border-violet-900/60 dark:bg-violet-950/20'
}
