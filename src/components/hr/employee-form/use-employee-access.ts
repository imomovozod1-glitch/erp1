'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Permissions } from '@/lib/permissions'
import { isStrongPassword } from '@/lib/password-validation'
import { isValidPhone } from '@/lib/phone-validation'
import { linkableAccounts, permissionsOf, type EmployeeFormOptions } from './employee-schema'

export type AccessMode = 'none' | 'link' | 'create'

interface AccessErrors {
  profile?: string
  phone?: string
  password?: string
}

/** Whether, and how, the employee gets a login — kept outside react-hook-form, with its own error slots. */
export function useEmployeeAccess(initial: any, options: EmployeeFormOptions) {
  const t = useTranslations()
  const accounts = linkableAccounts(options, initial?.profile_id)
  const [mode, setMode] = useState<AccessMode>(initial?.profile_id ? 'link' : 'none')
  const [isPaid, setPaidState] = useState<boolean>(initial?.is_paid ?? false)
  const [profileId, setProfileId] = useState<string | null>(initial?.profile_id ?? null)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [roleTemplateId, setRoleTemplateId] = useState<string | null>(initial?.role_template_id ?? null)
  const [permissions, setPermissions] = useState<Permissions>(() => permissionsOf(options.profiles.find((p) => p.id === initial?.profile_id)))
  const [errors, setErrors] = useState<AccessErrors>({})

  const setPaid = (next: boolean) => {
    setPaidState(next)
    if (!next) setMode('none')
  }

  const chooseAccount = (id: string) => {
    setProfileId(id || null)
    setPermissions(permissionsOf(accounts.find((p) => p.id === id)))
  }

  const chooseTemplate = (id: string) => {
    setRoleTemplateId(id || null)
    setPermissions(permissionsOf(options.roleTemplates.find((r) => r.id === id)))
  }

  // A grant changed by hand is no longer the template's — else the next template edit would undo it.
  const editPermissions = (next: Permissions) => {
    setPermissions(next)
    setRoleTemplateId(null)
  }

  const validate = () => {
    const next: AccessErrors = {}
    if (mode === 'link' && !profileId) next.profile = t('hr.selectAccountRequired')
    if (mode === 'create' && !isValidPhone(phone)) next.phone = t('auth.invalidPhone')
    if (mode === 'create' && !isStrongPassword(password)) next.password = t('auth.passwordRequirements')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  return {
    accounts, roleTemplates: options.roleTemplates, mode, setMode, isPaid, setPaid,
    profileId, chooseAccount, phone, setPhone, password, setPassword,
    roleTemplateId, chooseTemplate, permissions, editPermissions, errors, validate,
  }
}

export type EmployeeAccess = ReturnType<typeof useEmployeeAccess>
