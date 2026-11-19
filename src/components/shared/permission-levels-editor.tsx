'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Contact,
  DollarSign,
  Factory,
  Package,
  Settings,
  ShieldCheck,
  ShieldOff,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STATUS_DOT_STYLES, STATUS_TONE_STYLES, type StatusTone } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import {
  ACCESS_LEVELS,
  MATRIX_MODULES,
  PERMISSION_RESOURCES,
  accessLevel,
  flattenLevels,
  levelsFor,
  type AccessLevel,
  type LevelAction,
  type ModuleLevels,
  type PermissionModule,
  type PermissionResource,
  type Permissions,
  type ResourceLevels,
} from '@/lib/permissions'

interface PermissionLevelsEditorProps {
  value: Permissions
  onChange: (next: Permissions) => void
  disabled?: boolean
}

const COLUMNS: LevelAction[] = ['view', 'create', 'edit', 'delete', 'export']

/** How far a level reaches, for keeping the actions of one section consistent. */
const RANK: Record<AccessLevel, number> = { none: 0, own: 1, department: 2, all: 3 }

/** The same tones the status pills use, so a level reads like a status anywhere in the app. */
const LEVEL_TONE: Record<AccessLevel, StatusTone> = {
  none: 'slate',
  own: 'amber',
  department: 'blue',
  all: 'emerald',
}

/** The sidebar's icon for each module, so the editor reads like the app it controls. */
const MODULE_ICON: Partial<Record<PermissionModule, LucideIcon>> = {
  analytics: TrendingUp,
  pos: Store,
  inventory: Package,
  sales: ShoppingCart,
  customers: Contact,
  procurement: Truck,
  finance: DollarSign,
  hr: Users,
  production: Factory,
  settings: Settings,
}

type GrantState = 'full' | 'partial' | 'none'

/** Every action of a section at the widest level it offers — or closed. */
function wholeSection(resource: PermissionResource, granted: boolean): ResourceLevels {
  return Object.fromEntries(
    resource.actions.map((action) => {
      const offered = levelsFor(resource, action)
      return [action, granted ? offered[offered.length - 1] : 'none']
    })
  ) as ResourceLevels
}

function sectionState(resource: PermissionResource, section: ResourceLevels): GrantState {
  const levels = resource.actions.map((action) => section[action] ?? 'none')
  if (levels.every((level) => level === 'none')) return 'none'
  const full = resource.actions.every((action) => {
    const offered = levelsFor(resource, action)
    return section[action] === offered[offered.length - 1]
  })
  return full ? 'full' : 'partial'
}

function combineStates(states: GrantState[]): GrantState {
  if (states.every((s) => s === 'full')) return 'full'
  if (states.every((s) => s === 'none')) return 'none'
  return 'partial'
}

/**
 * Keeps one section's actions coherent after a single change:
 *
 *   - seeing is the floor of everything else: nobody edits, deletes or exports
 *     records they cannot see, so raising an action raises `view` with it and
 *     narrowing `view` narrows the others to it;
 *   - creating needs the section open at all, at least to see one's own records.
 */
function applyChange(
  resource: PermissionResource,
  section: ResourceLevels,
  action: LevelAction,
  level: AccessLevel
): ResourceLevels {
  const next: ResourceLevels = { ...section, [action]: level }
  const view = next.view ?? 'none'
  if (action === 'view') {
    for (const other of resource.actions) {
      if (other === 'view') continue
      if (level === 'none') next[other] = 'none'
      else if (other !== 'create' && RANK[next[other] ?? 'none'] > RANK[level]) next[other] = level
    }
    return next
  }
  if (level === 'none' || !resource.actions.includes('view')) return next
  if (action === 'create') {
    if (view === 'none') next.view = resource.ownable ? 'own' : 'all'
  } else if (RANK[view] < RANK[level]) {
    next.view = level
  }
  return next
}

/**
 * Permissions as the app is laid out: a card per module (with its sidebar
 * icon), a row per page of it, and in each cell how far that action reaches —
 * not at all, the user's own records, their department's, or everything.
 *
 * Shortcuts at every level: a switch per page, one per module, and the
 * toolbar's grant-all / clear-all. Each switch is on only when everything
 * under it is granted in full; anything less shows as "partial".
 *
 * It writes `levels` plus the module flags they imply (`flattenLevels`), so
 * every module-level check — and `app_can` in the database — keeps working. A
 * grant saved by the old module-only editor opens with its flags spread over
 * every page.
 */
export function PermissionLevelsEditor({ value, onChange, disabled }: PermissionLevelsEditorProps) {
  const tNav = useTranslations('nav')
  const tPerm = useTranslations('permissions')
  const [expanded, setExpanded] = useState<Set<PermissionModule>>(() => new Set())

  const levelsOf = (module: PermissionModule): ModuleLevels => {
    const levels: ModuleLevels = {}
    for (const resource of PERMISSION_RESOURCES[module]) {
      levels[resource.key] = {}
      for (const action of resource.actions) {
        levels[resource.key][action] = accessLevel('staff', value, module, resource.key, action)
      }
    }
    return levels
  }

  const write = (module: PermissionModule, levels: ModuleLevels) =>
    onChange({ ...value, [module]: flattenLevels(levels) })

  const setCell = (module: PermissionModule, resource: PermissionResource, action: LevelAction, level: AccessLevel) => {
    const levels = levelsOf(module)
    write(module, { ...levels, [resource.key]: applyChange(resource, levels[resource.key], action, level) })
  }

  const setSection = (module: PermissionModule, resource: PermissionResource, granted: boolean) =>
    write(module, { ...levelsOf(module), [resource.key]: wholeSection(resource, granted) })

  const setModule = (module: PermissionModule, granted: boolean) =>
    write(
      module,
      Object.fromEntries(PERMISSION_RESOURCES[module].map((r) => [r.key, wholeSection(r, granted)]))
    )

  const setEverything = (granted: boolean) => {
    const next: Permissions = { ...value }
    for (const moduleKey of MATRIX_MODULES) {
      next[moduleKey] = flattenLevels(
        Object.fromEntries(PERMISSION_RESOURCES[moduleKey].map((r) => [r.key, wholeSection(r, granted)]))
      )
    }
    onChange(next)
  }

  const toggleExpanded = (module: PermissionModule) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(module)) next.delete(module)
      else next.add(module)
      return next
    })
  const allExpanded = expanded.size === MATRIX_MODULES.length

  const resourceName = (module: PermissionModule, resource: PermissionResource) =>
    resource.key === 'main' ? tNav(module) : tPerm(`resource_${module}_${resource.key}`)

  const stateBadge = (state: GrantState) => {
    const tone: StatusTone = state === 'full' ? 'emerald' : state === 'partial' ? 'indigo' : 'slate'
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
          STATUS_TONE_STYLES[tone]
        )}
      >
        <span className={cn('size-1.5 rounded-full', STATUS_DOT_STYLES[tone])} />
        {tPerm(`state_${state}`)}
      </span>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: what the colours mean, and the shortcuts that span every module. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/40 p-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs font-semibold text-muted-foreground">{tPerm('legendTitle')}</span>
          {ACCESS_LEVELS.map((level) => (
            <span key={level} className="inline-flex items-center gap-1.5 text-xs text-foreground" title={tPerm(`levelDesc_${level}`)}>
              <span className={cn('size-2 rounded-full', STATUS_DOT_STYLES[LEVEL_TONE[level]])} />
              <span className="font-medium">{tPerm(`levelShort_${level}`)}</span>
              <span className="text-muted-foreground max-2xl:hidden">— {tPerm(`levelDesc_${level}`)}</span>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-nowrap">
          <Button
            type="button"
            variant="ghost"
            className="col-span-2 justify-center sm:col-span-1"
            size="sm"
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(MATRIX_MODULES))}
          >
            {allExpanded ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
            {allExpanded ? tPerm('collapseAll') : tPerm('expandAll')}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setEverything(true)}>
            <ShieldCheck className="size-4" />
            {tPerm('grantAll')}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setEverything(false)}>
            <ShieldOff className="size-4" />
            {tPerm('clearAll')}
          </Button>
        </div>
      </div>

      {MATRIX_MODULES.map((module) => {
        const isOpen = expanded.has(module)
        const levels = levelsOf(module)
        const sections = PERMISSION_RESOURCES[module]
        const states = sections.map((resource) => sectionState(resource, levels[resource.key]))
        const moduleState = combineStates(states)
        const granted = states.filter((s) => s !== 'none').length
        const Icon = MODULE_ICON[module] ?? ShieldCheck
        return (
          <section
            key={module}
            className={cn(
              'overflow-hidden rounded-2xl border bg-card transition-shadow duration-200',
              isOpen ? 'border-violet-200 shadow-sm dark:border-violet-900/60' : 'border-border/60 hover:shadow-sm'
            )}
          >
            <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleExpanded(module)}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                    moduleState === 'none'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-brand-subtle text-violet-700 dark:text-violet-300'
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{tNav(module)}</span>
                  {sections.length > 1 && (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {tPerm('sectionsCount', { on: granted, total: sections.length })}
                    </span>
                  )}
                </span>
                <span className="max-sm:hidden">{stateBadge(moduleState)}</span>
                <ChevronDown
                  className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')}
                />
              </button>
              <Switch
                checked={moduleState === 'full'}
                onCheckedChange={() => setModule(module, moduleState !== 'full')}
                disabled={disabled}
                aria-label={`${tNav(module)} — ${tPerm('moduleAll')}`}
                title={tPerm('moduleAll')}
              />
            </div>

            {isOpen && (
              <div className="border-t border-border/60">
                {/* Desktop: sections down, actions across. */}
                <div className="overflow-x-auto max-md:hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 text-left font-semibold">{tPerm('section')}</th>
                        {COLUMNS.map((action) => (
                          <th key={action} className="w-36 px-2 py-2.5 text-left font-semibold">
                            {tPerm(`action_${action}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {sections.map((resource, index) => (
                        <tr key={resource.key} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-3">
                              <Switch
                                checked={states[index] === 'full'}
                                onCheckedChange={() => setSection(module, resource, states[index] !== 'full')}
                                disabled={disabled}
                                aria-label={`${resourceName(module, resource)} — ${tPerm('sectionAll')}`}
                                title={tPerm('sectionAll')}
                              />
                              <span className="font-medium text-foreground">{resourceName(module, resource)}</span>
                            </span>
                          </td>
                          {COLUMNS.map((action) => (
                            <td key={action} className="px-2 py-2.5">
                              {resource.actions.includes(action) ? (
                                <LevelSelect
                                  label={`${resourceName(module, resource)} — ${tPerm(`action_${action}`)}`}
                                  levels={levelsFor(resource, action)}
                                  value={levels[resource.key][action] ?? 'none'}
                                  disabled={disabled}
                                  onChange={(level) => setCell(module, resource, action, level)}
                                />
                              ) : (
                                <span className="pl-3 text-muted-foreground/50" aria-hidden>—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Phone: a card per section, an action per row. */}
                <div className="space-y-2.5 p-3 md:hidden">
                  {sections.map((resource, index) => (
                    <div key={resource.key} className="rounded-2xl border border-border/60 bg-muted/30 p-3">
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{resourceName(module, resource)}</p>
                          <div className="mt-1">{stateBadge(states[index])}</div>
                        </div>
                        <Switch
                          checked={states[index] === 'full'}
                          onCheckedChange={() => setSection(module, resource, states[index] !== 'full')}
                          disabled={disabled}
                          aria-label={`${resourceName(module, resource)} — ${tPerm('sectionAll')}`}
                        />
                      </div>
                      <div className="space-y-2">
                        {COLUMNS.filter((action) => resource.actions.includes(action)).map((action) => (
                          <div key={action} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-muted-foreground">{tPerm(`action_${action}`)}</span>
                            <div className="w-40 shrink-0">
                              <LevelSelect
                                label={`${resourceName(module, resource)} — ${tPerm(`action_${action}`)}`}
                                levels={levelsFor(resource, action)}
                                value={levels[resource.key][action] ?? 'none'}
                                disabled={disabled}
                                onChange={(level) => setCell(module, resource, action, level)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

/** One cell: a compact, colour-coded pill that opens the levels this action offers. */
function LevelSelect({
  label,
  levels,
  value,
  disabled,
  onChange,
}: {
  label: string
  levels: readonly AccessLevel[]
  value: AccessLevel
  disabled?: boolean
  onChange: (level: AccessLevel) => void
}) {
  const tPerm = useTranslations('permissions')
  const tone = LEVEL_TONE[value]
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => next && onChange(next as AccessLevel)}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          'h-9 w-full rounded-full border px-3 text-xs font-semibold shadow-none md:h-8',
          STATUS_TONE_STYLES[tone]
        )}
      >
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <span className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT_STYLES[tone])} />
            {tPerm(`levelShort_${value}`)}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" className="w-64 rounded-2xl p-1.5">
        {levels.map((level) => (
          <SelectItem key={level} value={level} className="rounded-xl py-2 pl-2.5">
            <span className="flex items-start gap-2.5">
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', STATUS_DOT_STYLES[LEVEL_TONE[level]])} />
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{tPerm(`levelShort_${level}`)}</span>
                <span className="text-xs text-muted-foreground">{tPerm(`levelDesc_${level}`)}</span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
