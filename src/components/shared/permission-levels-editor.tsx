'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, CircleHelp } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
} from '@/lib/permissions'

interface PermissionLevelsEditorProps {
  value: Permissions
  onChange: (next: Permissions) => void
  disabled?: boolean
}

const COLUMNS: LevelAction[] = ['create', 'view', 'edit', 'delete', 'export']

/** The level furthest up the grid first: a cell reads top to bottom as the legend does. */
const LEVEL_ORDER = ACCESS_LEVELS

/**
 * Section x action grid: each module is an accordion row with a switch, each
 * cell picks how far that action reaches. Replaces the module checkboxes for a
 * company with the `permissions_v2` flag.
 *
 * It writes `levels` plus the flags they imply (`flattenLevels`), so everything
 * that reads a module-level permission keeps working. A user saved by the older
 * editor opens with those flags spread over every section.
 */
export function PermissionLevelsEditor({ value, onChange, disabled }: PermissionLevelsEditorProps) {
  const tNav = useTranslations('nav')
  const tPerm = useTranslations('permissions')
  const [open, setOpen] = useState<PermissionModule | null>(null)

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

  const setCell = (module: PermissionModule, resource: string, action: LevelAction, level: AccessLevel) => {
    const levels = levelsOf(module)
    const section = { ...levels[resource], [action]: level }
    if (action === 'view' && level === 'none') {
      // Losing sight of a section removes everything that acts on it.
      for (const key of Object.keys(section) as LevelAction[]) section[key] = 'none'
    } else if (action !== 'view' && level !== 'none' && section.view === 'none') {
      section.view = level
    }
    onChange({ ...value, [module]: flattenLevels({ ...levels, [resource]: section }) })
  }

  const setModule = (module: PermissionModule, granted: boolean) => {
    const levels: ModuleLevels = {}
    for (const resource of PERMISSION_RESOURCES[module]) {
      levels[resource.key] = Object.fromEntries(
        resource.actions.map((action) => [action, granted ? 'all' : 'none'])
      )
    }
    onChange({ ...value, [module]: flattenLevels(levels) })
  }

  const isOn = (module: PermissionModule) =>
    Object.values(levelsOf(module)).some((section) => Object.values(section).some((level) => level !== 'none'))

  const resourceName = (module: PermissionModule, resource: PermissionResource) =>
    resource.key === 'main' ? tNav(module) : tPerm(`resource_${module}_${resource.key}`)

  const levelName = (level: AccessLevel) => tPerm(`level_${level}`)

  return (
    <TooltipProvider>
      <div className="divide-y rounded-2xl border dark:divide-slate-800 dark:border-slate-800">
        {MATRIX_MODULES.map((module) => {
          const expanded = open === module
          const levels = levelsOf(module)
          return (
            <div key={module}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : module)}
                  className="flex min-h-10 flex-1 items-center gap-2 rounded-lg text-left text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  <ChevronRight className={cn('h-4 w-4 text-slate-400 transition-transform duration-200', expanded && 'rotate-90')} />
                  {tNav(module)}
                </button>
                <Switch
                  checked={isOn(module)}
                  onCheckedChange={(checked) => setModule(module, checked)}
                  disabled={disabled}
                  aria-label={tNav(module)}
                />
              </div>

              {expanded && (
                <div className="border-t dark:border-slate-800">
                  {/* Desktop: the grid, with the legend once per row. */}
                  <div className="max-md:hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                          <th className="px-3 py-2" />
                          {COLUMNS.map((action) => (
                            <th key={action} className="w-20 px-2 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">
                              {tPerm(`action_${action}`)}
                            </th>
                          ))}
                          <th className="w-44 px-3 py-2 text-left">
                            <Tooltip>
                              <TooltipTrigger render={<span className="inline-flex" />}>
                                <CircleHelp className="h-4 w-4 text-slate-400" />
                                <span className="sr-only">{tPerm('levelHint')}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-64">{tPerm('levelHint')}</TooltipContent>
                            </Tooltip>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {PERMISSION_RESOURCES[module].map((resource) => (
                          <tr key={resource.key} className="border-t dark:border-slate-800">
                            <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{resourceName(module, resource)}</td>
                            {COLUMNS.map((action) => (
                              <td key={action} className="px-2 py-3">
                                {resource.actions.includes(action) && (
                                  <LevelPicker
                                    label={`${resourceName(module, resource)} — ${tPerm(`action_${action}`)}`}
                                    levels={levelsFor(resource, action)}
                                    slots={resource.ownable ? LEVEL_ORDER : ['none', 'all']}
                                    value={levels[resource.key][action] ?? 'none'}
                                    levelName={levelName}
                                    disabled={disabled}
                                    onChange={(level) => setCell(module, resource.key, action, level)}
                                  />
                                )}
                              </td>
                            ))}
                            <td className="px-3 py-3 align-middle">
                              <div className="grid gap-1 text-xs leading-6 text-slate-600 dark:text-slate-400">
                                {(resource.ownable ? LEVEL_ORDER : (['none', 'all'] as const)).map((level) => (
                                  <span key={level}>{levelName(level)}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Phone: five columns do not fit, so a card per section. */}
                  <div className="space-y-3 p-3 md:hidden">
                    {PERMISSION_RESOURCES[module].map((resource) => (
                      <div key={resource.key} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
                        <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{resourceName(module, resource)}</p>
                        <div className="space-y-2.5">
                          {resource.actions.map((action) => {
                            const level = levels[resource.key][action] ?? 'none'
                            return (
                              <div key={action} className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-slate-700 dark:text-slate-300">{tPerm(`action_${action}`)}</p>
                                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{levelName(level)}</p>
                                </div>
                                <LevelPicker
                                  horizontal
                                  label={`${resourceName(module, resource)} — ${tPerm(`action_${action}`)}`}
                                  levels={levelsFor(resource, action)}
                                  slots={resource.ownable ? LEVEL_ORDER : ['none', 'all']}
                                  value={level}
                                  levelName={levelName}
                                  disabled={disabled}
                                  onChange={(next) => setCell(module, resource.key, action, next)}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

function LevelPicker({
  label,
  levels,
  slots,
  value,
  levelName,
  disabled,
  horizontal,
  onChange,
}: {
  label: string
  levels: readonly AccessLevel[]
  /** Every level the row's legend lists, so an offered dot sits beside its own label. */
  slots: readonly AccessLevel[]
  value: AccessLevel
  levelName: (level: AccessLevel) => string
  disabled?: boolean
  horizontal?: boolean
  onChange: (level: AccessLevel) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('mx-auto flex w-fit items-center', horizontal ? 'flex-row' : 'flex-col')}
    >
      {slots.map((level) => {
        if (!levels.includes(level)) {
          return <span key={level} aria-hidden="true" className={horizontal ? 'h-10 w-8' : 'h-7 w-7'} />
        }
        const selected = value === level
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={levelName(level)}
            title={levelName(level)}
            disabled={disabled}
            onClick={() => onChange(level)}
            className={cn(
              'flex items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50',
              // The dots line up with the legend's rows; the touch target is the button.
              horizontal ? 'h-10 w-8' : 'h-7 w-7'
            )}
          >
            <span
              className={cn(
                'h-3.5 w-3.5 rounded-full transition-colors duration-200',
                selected ? 'bg-emerald-500' : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
