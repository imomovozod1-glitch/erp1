'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { PhoneInput } from '@/components/ui/phone-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { LabeledField } from '@/components/shared/labeled-field'
import { NameSelect } from '@/components/shared/name-select'
import { PermissionsEditor } from '@/components/shared/permissions/permissions-editor'
import type { AccessMode, EmployeeAccess } from './use-employee-access'

function RoleAndPermissions({ access }: { access: EmployeeAccess }) {
  const t = useTranslations()
  return (
    <div className="space-y-3">
      <LabeledField id="role-template" label={t('hr.selectRoleTemplate')} className="sm:w-80">
        <NameSelect
          id="role-template"
          value={access.roleTemplateId ?? ''}
          onChange={access.chooseTemplate}
          options={access.roleTemplates}
          placeholder={t('hr.noRoleTemplate')}
          clearLabel={t('hr.noRoleTemplate')}
        />
      </LabeledField>
      <div className="space-y-2">
        <Label>{t('settings.permissions')}</Label>
        <PermissionsEditor value={access.permissions} onChange={access.editPermissions} />
      </div>
    </div>
  )
}

function LinkAccount({ access }: { access: EmployeeAccess }) {
  const t = useTranslations('hr')
  const options = access.accounts.map((p) => ({ id: p.id, name: p.full_name && p.phone ? `${p.full_name} (${p.phone})` : p.full_name || p.phone || p.id }))
  return (
    <div className="space-y-3 animate-in duration-200 fade-in">
      <LabeledField id="system-access" label={t('systemAccessLink')} error={access.errors.profile} className="sm:w-80">
        <NameSelect id="system-access" value={access.profileId ?? ''} onChange={access.chooseAccount} options={options} placeholder={t('selectAccount')} />
      </LabeledField>
      {access.profileId && <RoleAndPermissions access={access} />}
    </div>
  )
}

function NewAccount({ access }: { access: EmployeeAccess }) {
  const t = useTranslations()
  return (
    <div className="space-y-3 animate-in duration-200 fade-in">
      <p className="text-xs text-muted-foreground">{t('hr.newAccountFields')}</p>
      <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <LabeledField id="new-account-phone" label={t('auth.phone')} error={access.errors.phone}>
          <PhoneInput id="new-account-phone" value={access.phone} onChange={access.setPhone} placeholder="90 123 45 67" />
        </LabeledField>
        <LabeledField id="new-account-password" label={t('auth.password')} error={access.errors.password}>
          <PasswordInput
            id="new-account-password"
            placeholder="••••••••"
            value={access.password}
            onChange={(e) => access.setPassword(e.target.value)}
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
          />
          {!access.errors.password && <p className="text-xs text-muted-foreground">{t('auth.passwordRequirements')}</p>}
        </LabeledField>
      </div>
      <RoleAndPermissions access={access} />
    </div>
  )
}

export function EmployeeAccessSection({ access }: { access: EmployeeAccess }) {
  const t = useTranslations('hr')
  const modes: { value: AccessMode; label: string; disabled?: boolean }[] = [
    { value: 'none', label: t('systemAccessNone') },
    { value: 'link', label: t('systemAccessLink'), disabled: !access.isPaid },
    { value: 'create', label: t('systemAccessCreate'), disabled: !access.isPaid },
  ]
  return (
    <div className="space-y-3 border-t pt-4">
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox id="is_paid" checked={access.isPaid} onCheckedChange={(checked) => access.setPaid(checked === true)} />
        <span className="text-sm font-medium">{t('isPaid')}</span>
      </label>
      <p className="text-xs text-muted-foreground">{t('isPaidHint')}</p>
      <Label className="pt-2">{t('systemAccess')}</Label>
      <SegmentedControl<AccessMode> label={t('systemAccess')} value={access.mode} onChange={access.setMode} options={modes} className="w-full sm:w-fit" />
      {!access.isPaid && <p className="text-xs text-amber-600 dark:text-amber-400">{t('systemAccessRequiresPaid')}</p>}
      {access.isPaid && access.mode === 'none' && <p className="text-xs text-muted-foreground">{t('systemAccessHint')}</p>}
      {access.mode === 'link' && <LinkAccount access={access} />}
      {access.mode === 'create' && <NewAccount access={access} />}
    </div>
  )
}
