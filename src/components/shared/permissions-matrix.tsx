'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { PERMISSION_MODULES, type Permissions, type PermissionModule, type ModulePermission } from '@/lib/permissions'

interface PermissionsMatrixProps {
  value: Permissions
  onChange: (next: Permissions) => void
  disabled?: boolean
}

/**
 * Module x (View, Edit) checkbox grid — the single shared editor for
 * `profiles.permissions`, used both from Settings → Users (existing
 * accounts) and the HR Add/Edit Employee form (when an employee is linked
 * to a login). Module keys match `app-sidebar.tsx`'s NAV_ITEMS 1:1 so this
 * maps directly onto what the user will see in their sidebar.
 */
export function PermissionsMatrix({ value, onChange, disabled }: PermissionsMatrixProps) {
  const tNav = useTranslations('nav')
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('settings')

  // Editing implies viewing: turning Edit on also turns View on; turning
  // View off also turns Edit off (can't edit a module you can't see).
  const toggle = (module: PermissionModule, field: 'view' | 'edit') => {
    const current = value[module] ?? { view: false, edit: false }
    const turnedOn = !current[field]
    const next: ModulePermission = { ...current, [field]: turnedOn }
    if (field === 'edit' && turnedOn) next.view = true
    if (field === 'view' && !turnedOn) next.edit = false
    onChange({ ...value, [module]: next })
  }

  return (
    <div className="rounded-lg border dark:border-slate-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
            <th className="text-left font-semibold text-slate-600 dark:text-slate-400 px-3 py-2">
              {tSettings('moduleColumn')}
            </th>
            <th className="text-center font-semibold text-slate-600 dark:text-slate-400 px-3 py-2 w-24">
              {tCommon('view')}
            </th>
            <th className="text-center font-semibold text-slate-600 dark:text-slate-400 px-3 py-2 w-24">
              {tCommon('edit')}
            </th>
          </tr>
        </thead>
        <tbody>
          {PERMISSION_MODULES.map((module) => {
            const perm = value[module] ?? { view: false, edit: false }
            return (
              <tr key={module} className="border-b last:border-b-0 dark:border-slate-800">
                <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{tNav(module)}</td>
                <td className="px-3 py-2 text-center">
                  <Checkbox
                    checked={perm.view}
                    disabled={disabled}
                    onCheckedChange={() => toggle(module, 'view')}
                    aria-label={`${tNav(module)} ${tCommon('view')}`}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <Checkbox
                    checked={perm.edit}
                    disabled={disabled}
                    onCheckedChange={() => toggle(module, 'edit')}
                    aria-label={`${tNav(module)} ${tCommon('edit')}`}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
