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
  Info,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  MATRIX_MODULES,
  PERMISSION_RESOURCES,
  accessLevel,
  flattenLevels,
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

/** How far a level reaches; used to read one "which records" value off a section. */
const RANK: Record<AccessLevel, number> = { none: 0, own: 1, department: 2, all: 3 }

type Scope = Exclude<AccessLevel, 'none'>
const SCOPES: Scope[] = ['own', 'department', 'all']

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

/** Ticked / partly ticked / not ticked — what a group checkbox shows. */
type Tick = 'all' | 'some' | 'none'

function combine(ticks: Tick[]): Tick {
  if (ticks.every((t) => t === 'all')) return 'all'
  if (ticks.every((t) => t === 'none')) return 'none'
  return 'some'
}

/**
 * The single "which records" value of a section: the widest level its
 * actions use, or everything when nothing is ticked yet. Creating does not
 * count — a new record has no owner yet.
 */
function scopeOf(resource: PermissionResource, section: ResourceLevels): Scope {
  if (!resource.ownable) return 'all'
  let widest: AccessLevel = 'none'
  for (const action of resource.actions) {
    if (action === 'create') continue
    const level = section[action] ?? 'none'
    if (RANK[level] > RANK[widest]) widest = level
  }
  return widest === 'none' ? 'all' : widest
}

/** The section's levels with these actions ticked, all at one scope. */
function sectionWith(resource: PermissionResource, ticked: Set<LevelAction>, scope: Scope): ResourceLevels {
  const out: ResourceLevels = {}
  for (const action of resource.actions) {
    // Creating has no owner to scope by; everything else follows the section.
    out[action] = !ticked.has(action) ? 'none' : action === 'create' || !resource.ownable ? 'all' : scope
  }
  return out
}

function tickedOf(resource: PermissionResource, section: ResourceLevels): Set<LevelAction> {
  return new Set(resource.actions.filter((action) => (section[action] ?? 'none') !== 'none'))
}

/**
 * Permissions in plain terms, for whoever sets up a role — not someone who
 * thinks in access levels. A card per module (with its sidebar icon), a row
 * per page of it, a checkbox per thing the person may do there, and — only on
 * pages whose records belong to someone — one "which records" choice: only
 * their own, their department's, or all.
 *
 * Every group has a checkbox of its own (the module, each page) that shows a
 * dash when only part of it is ticked. Seeing a page is implied by doing
 * anything on it, and taking "see" away takes everything else with it.
 *
 * The data underneath is unchanged: per-action levels in `levels` plus the
 * module flags they imply (`flattenLevels`), read by every check in the app
 * and by `app_can` in the database.
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

  const toggleAction = (module: PermissionModule, resource: PermissionResource, action: LevelAction, on: boolean) => {
    const levels = levelsOf(module)
    const section = levels[resource.key]
    const ticked = tickedOf(resource, section)
    if (on) {
      ticked.add(action)
      // Doing anything on a page means being able to open it.
      if (resource.actions.includes('view')) ticked.add('view')
    } else if (action === 'view') {
      ticked.clear()
    } else {
      ticked.delete(action)
    }
    write(module, { ...levels, [resource.key]: sectionWith(resource, ticked, scopeOf(resource, section)) })
  }

  const setScope = (module: PermissionModule, resource: PermissionResource, scope: Scope) => {
    const levels = levelsOf(module)
    const section = levels[resource.key]
    write(module, { ...levels, [resource.key]: sectionWith(resource, tickedOf(resource, section), scope) })
  }

  const setSection = (module: PermissionModule, resource: PermissionResource, on: boolean) => {
    const levels = levelsOf(module)
    const section = levels[resource.key]
    write(module, {
      ...levels,
      [resource.key]: sectionWith(resource, on ? new Set(resource.actions) : new Set(), scopeOf(resource, section)),
    })
  }

  const setModule = (module: PermissionModule, on: boolean) => {
    const levels = levelsOf(module)
    write(
      module,
      Object.fromEntries(
        PERMISSION_RESOURCES[module].map((r) => [
          r.key,
          sectionWith(r, on ? new Set(r.actions) : new Set(), scopeOf(r, levels[r.key])),
        ])
      )
    )
  }

  const setEverything = (on: boolean) => {
    const next: Permissions = { ...value }
    for (const moduleKey of MATRIX_MODULES) {
      next[moduleKey] = flattenLevels(
        Object.fromEntries(
          PERMISSION_RESOURCES[moduleKey].map((r) => [r.key, sectionWith(r, on ? new Set(r.actions) : new Set(), 'all')])
        )
      )
    }
    onChange(next)
  }

  const sectionTick = (resource: PermissionResource, section: ResourceLevels): Tick => {
    const count = tickedOf(resource, section).size
    return count === 0 ? 'none' : count === resource.actions.length ? 'all' : 'some'
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

  const scopeSelect = (module: PermissionModule, resource: PermissionResource, section: ResourceLevels) => {
    const ticked = tickedOf(resource, section).size > 0
    const scope = scopeOf(resource, section)
    return (
      <Select
        value={scope}
        disabled={disabled || !ticked}
        onValueChange={(next) => next && setScope(module, resource, next as Scope)}
      >
        <SelectTrigger
          aria-label={`${resourceName(module, resource)} — ${tPerm('recordsTitle')}`}
          className="h-9 w-full rounded-xl text-xs font-medium md:h-8"
        >
          <SelectValue>{tPerm(`records_${scope}`)}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start" className="w-44 rounded-xl p-1">
          {SCOPES.map((option) => (
            <SelectItem key={option} value={option} className="rounded-lg py-1.5 text-sm">
              {tPerm(`records_${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-violet-200/70 bg-brand-subtle p-3 sm:flex-row sm:items-center sm:justify-between dark:border-violet-900/50">
        <p className="flex items-start gap-2 text-sm text-violet-900 dark:text-violet-100">
          <Info className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-300" />
          {tPerm('simpleHint')}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="col-span-2 justify-center sm:col-span-1"
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
        const ticks = sections.map((resource) => sectionTick(resource, levels[resource.key]))
        const moduleTick = combine(ticks)
        const granted = ticks.filter((t) => t !== 'none').length
        const hasScope = sections.some((resource) => resource.ownable)
        const Icon = MODULE_ICON[module] ?? ShieldCheck
        return (
          <section
            key={module}
            className={cn(
              'overflow-hidden rounded-2xl border bg-card transition-shadow duration-200',
              isOpen ? 'border-violet-200 shadow-sm dark:border-violet-900/60' : 'border-border/60 hover:shadow-sm'
            )}
          >
            <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
              <Checkbox
                size="lg"
                checked={moduleTick === 'all'}
                indeterminate={moduleTick === 'some'}
                onCheckedChange={() => setModule(module, moduleTick !== 'all')}
                disabled={disabled}
                aria-label={`${tNav(module)} — ${tPerm('selectModule')}`}
              />
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleExpanded(module)}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                    moduleTick === 'none' ? 'bg-muted text-muted-foreground' : 'bg-brand-subtle text-violet-700 dark:text-violet-300'
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
                <ChevronDown
                  className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')}
                />
              </button>
            </div>

            {isOpen && (
              <div className="border-t border-border/60">
                {/* Desktop: pages down, what they may do across. */}
                <div className="overflow-x-auto max-md:hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 text-left font-semibold">{tPerm('section')}</th>
                        {COLUMNS.map((action) => (
                          <th key={action} className="w-24 px-2 py-2.5 text-center font-semibold">
                            {tPerm(`action_${action}`)}
                          </th>
                        ))}
                        {hasScope && (
                          <th className="w-44 px-3 py-2.5 text-left font-semibold" title={tPerm('recordsHint')}>
                            {tPerm('recordsTitle')}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {sections.map((resource, index) => {
                        const section = levels[resource.key]
                        const ticked = tickedOf(resource, section)
                        return (
                          <tr
                            key={resource.key}
                            className={cn(
                              'transition-colors',
                              ticks[index] !== 'none' ? 'bg-violet-50/40 dark:bg-violet-950/10' : 'hover:bg-muted/30'
                            )}
                          >
                            <td className="px-4 py-2.5">
                              <label className="flex cursor-pointer items-center gap-3">
                                <Checkbox
                                  size="lg"
                                  checked={ticks[index] === 'all'}
                                  indeterminate={ticks[index] === 'some'}
                                  onCheckedChange={() => setSection(module, resource, ticks[index] !== 'all')}
                                  disabled={disabled}
                                  aria-label={`${resourceName(module, resource)} — ${tPerm('selectSection')}`}
                                />
                                <span className="font-medium text-foreground">{resourceName(module, resource)}</span>
                              </label>
                            </td>
                            {COLUMNS.map((action) => (
                              <td key={action} className="px-2 py-2.5 text-center">
                                {resource.actions.includes(action) ? (
                                  <span className="inline-flex">
                                    <Checkbox
                                      checked={ticked.has(action)}
                                      onCheckedChange={(on) => toggleAction(module, resource, action, on === true)}
                                      disabled={disabled}
                                      aria-label={`${resourceName(module, resource)} — ${tPerm(`action_${action}`)}`}
                                    />
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40" aria-hidden>—</span>
                                )}
                              </td>
                            ))}
                            {hasScope && (
                              <td className="px-3 py-2">
                                {resource.ownable ? (
                                  scopeSelect(module, resource, section)
                                ) : (
                                  <span className="pl-1 text-xs text-muted-foreground">{tPerm('records_all')}</span>
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Phone: a card per page, its permissions as tick boxes. */}
                <div className="space-y-2.5 p-3 md:hidden">
                  {sections.map((resource, index) => {
                    const section = levels[resource.key]
                    const ticked = tickedOf(resource, section)
                    return (
                      <div
                        key={resource.key}
                        className={cn(
                          'rounded-2xl border p-3',
                          ticks[index] !== 'none'
                            ? 'border-violet-200 bg-violet-50/50 dark:border-violet-900/60 dark:bg-violet-950/20'
                            : 'border-border/60 bg-muted/30'
                        )}
                      >
                        <label className="flex cursor-pointer items-center gap-3">
                          <Checkbox
                            size="lg"
                            checked={ticks[index] === 'all'}
                            indeterminate={ticks[index] === 'some'}
                            onCheckedChange={() => setSection(module, resource, ticks[index] !== 'all')}
                            disabled={disabled}
                            aria-label={`${resourceName(module, resource)} — ${tPerm('selectSection')}`}
                          />
                          <span className="text-sm font-semibold text-foreground">{resourceName(module, resource)}</span>
                        </label>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {COLUMNS.filter((action) => resource.actions.includes(action)).map((action) => (
                            <label
                              key={action}
                              className={cn(
                                'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm transition-colors',
                                ticked.has(action)
                                  ? 'border-violet-300 bg-card text-foreground dark:border-violet-800'
                                  : 'border-border/60 bg-card/60 text-muted-foreground'
                              )}
                            >
                              <Checkbox
                                checked={ticked.has(action)}
                                onCheckedChange={(on) => toggleAction(module, resource, action, on === true)}
                                disabled={disabled}
                              />
                              {tPerm(`action_${action}`)}
                            </label>
                          ))}
                        </div>
                        {resource.ownable && (
                          <div className="mt-3 space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">{tPerm('recordsTitle')}</p>
                            {scopeSelect(module, resource, section)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
