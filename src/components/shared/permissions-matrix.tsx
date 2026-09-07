'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  moduleSupportsApproval,
  normaliseModulePermission,
  NO_MODULE_ACCESS,
  type Permissions,
  type PermissionModule,
  type PermissionAction,
  type ModulePermission,
  type DataScope,
} from '@/lib/permissions'

interface PermissionsMatrixProps {
  value: Permissions
  onChange: (next: Permissions) => void
  disabled?: boolean
}

/**
 * Module x action grid — the single shared editor for `profiles.permissions`
 * and for role templates.
 *
 * Dependencies between actions are enforced here rather than left to the
 * admin: everything implies `view` (you cannot edit a module you cannot open),
 * and clearing `view` clears the rest. The same normalisation runs again
 * server-side in the API routes, so a hand-built payload cannot store an
 * incoherent combination either.
 */
export function PermissionsMatrix({ value, onChange, disabled }: PermissionsMatrixProps) {
  const tNav = useTranslations('nav')
  const tPerm = useTranslations('permissions')

  const entryFor = (module: PermissionModule): ModulePermission =>
    value[module] ? normaliseModulePermission(value[module]) : { ...NO_MODULE_ACCESS }

  const toggle = (module: PermissionModule, action: PermissionAction) => {
    const current = entryFor(module)
    const next: ModulePermission = { ...current, [action]: !current[action] }

    if (action === 'view' && !next.view) {
      // Losing sight of a module removes everything that acts on it.
      next.create = false
      next.edit = false
      next.delete = false
      next.export = false
      next.approve = false
    } else if (action !== 'view' && next[action]) {
      next.view = true
    }
    onChange({ ...value, [module]: next })
  }

  const setScope = (module: PermissionModule, scope: DataScope) => {
    onChange({ ...value, [module]: { ...entryFor(module), scope } })
  }

  /** Grants or clears an entire row in one click — the common case when setting up a role. */
  const setRow = (module: PermissionModule, granted: boolean) => {
    onChange({
      ...value,
      [module]: granted
        ? {
            view: true,
            create: true,
            edit: true,
            delete: true,
            export: true,
            approve: moduleSupportsApproval(module),
            scope: entryFor(module).scope,
          }
        : { ...NO_MODULE_ACCESS },
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border dark:border-slate-800">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">
              {tPerm('module')}
            </th>
            {PERMISSION_ACTIONS.map((action) => (
              <th
                key={action}
                className="w-20 px-2 py-2 text-center font-semibold text-slate-600 dark:text-slate-400"
              >
                {tPerm(`action_${action}`)}
              </th>
            ))}
            <th className="w-32 px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">
              {tPerm('scope')}
            </th>
            <th className="w-24 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {PERMISSION_MODULES.map((module) => {
            const perm = entryFor(module)
            const approvable = moduleSupportsApproval(module)
            const allGranted = PERMISSION_ACTIONS.every(
              (a) => (a === 'approve' && !approvable) || perm[a]
            )
            return (
              <tr key={module} className="border-b last:border-b-0 dark:border-slate-800">
                <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                  {tNav(module)}
                </td>

                {PERMISSION_ACTIONS.map((action) => {
                  // Approval is meaningless in modules with nothing to authorise.
                  const notApplicable = action === 'approve' && !approvable
                  return (
                    <td key={action} className="px-2 py-2 text-center">
                      {notApplicable ? (
                        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        <Checkbox
                          checked={perm[action]}
                          disabled={disabled}
                          onCheckedChange={() => toggle(module, action)}
                          aria-label={`${tNav(module)} — ${tPerm(`action_${action}`)}`}
                        />
                      )}
                    </td>
                  )
                })}

                <td className="px-3 py-2">
                  <Select
                    value={perm.scope}
                    onValueChange={(v) => setScope(module, v === 'own' ? 'own' : 'all')}
                  >
                    <SelectTrigger
                      className="h-8 w-full"
                      disabled={disabled || !perm.view}
                      aria-label={`${tNav(module)} — ${tPerm('scope')}`}
                    >
                      <SelectValue>{tPerm(`scope_${perm.scope}`)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tPerm('scope_all')}</SelectItem>
                      <SelectItem value="own">{tPerm('scope_own')}</SelectItem>
                    </SelectContent>
                  </Select>
                </td>

                <td className="px-2 py-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={disabled}
                    onClick={() => setRow(module, !allGranted)}
                  >
                    {allGranted ? tPerm('clearAll') : tPerm('grantAll')}
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="border-t bg-slate-50/60 px-3 py-2 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-800/30">
        {tPerm('scopeHint')}
      </p>
    </div>
  )
}
