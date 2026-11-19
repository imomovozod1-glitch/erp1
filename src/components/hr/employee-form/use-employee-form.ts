'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { invalidateEmployees, invalidateProfile } from '@/lib/data/revalidate'
import { errorMessage } from '@/lib/error-message'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { isoDate } from '@/lib/utils'
import {
  AccountCreateError,
  createLogin,
  EmployeeCodeTakenError,
  employeePayload,
  ensureCashbox,
  insertEmployee,
  saveLinkedAccess,
  updateEmployee,
} from './employee-save'
import { employeeDefaults, employeeSchema, type EmployeeData, type EmployeeFormOptions } from './employee-schema'
import { useEmployeeAccess } from './use-employee-access'

export function useEmployeeForm(initial: any, options: EmployeeFormOptions, lang: string) {
  const t = useTranslations()
  const exitForm = useRouteModalExit(`/${lang}/hr/employees`)
  const access = useEmployeeAccess(initial, options)
  const [cashboxId, setCashboxId] = useState<string | null>(initial?.cashbox_id ?? null)
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<EmployeeData>({
    resolver: zodResolver(employeeSchema(t, isoDate())) as unknown as Resolver<EmployeeData>,
    defaultValues: employeeDefaults(initial, options.nextEmployeeCode),
  })

  const resolveProfile = async (data: EmployeeData) => {
    if (access.mode === 'link') return access.profileId
    if (access.mode !== 'create') return null
    return createLogin({
      fullName: data.full_name,
      phone: access.phone,
      password: access.password,
      permissions: access.permissions,
      roleTemplateId: access.roleTemplateId,
      isPaid: access.isPaid,
    })
  }

  const persist = async (data: EmployeeData) => {
    const supabase = createClient()
    const profileId = await resolveProfile(data)
    const description = t('hr.employeeCashboxDescription', { name: data.full_name })
    const cashbox = await ensureCashbox(supabase, cashboxId ?? initial?.cashbox_id ?? null, data.full_name, description)
    const payload = employeePayload(data, initial, options.nextEmployeeCode, { profileId, isPaid: access.isPaid, cashboxId: cashbox })
    if (initial?.id) await updateEmployee(supabase, initial.id, payload)
    else await insertEmployee(supabase, payload, !data.employee_code || data.employee_code === options.nextEmployeeCode)
    toast.success(t(initial?.id ? 'common.saved' : 'common.created'))
    if (access.mode === 'link' && profileId) {
      await saveLinkedAccess(profileId, access.permissions, access.roleTemplateId)
      await invalidateProfile(profileId)
    }
  }

  const failure = (error: unknown) => {
    if (error instanceof EmployeeCodeTakenError) return t('hr.employeeCodeTaken')
    if (error instanceof AccountCreateError) return errorMessage(t, error.body, t('hr.createAccountError'))
    return errorMessage(t, error, t('common.error'))
  }

  const submit = async (data: EmployeeData) => {
    if (access.mode !== 'none' && !access.isPaid) return void toast.error(t('hr.systemAccessRequiresPaid'))
    if (!access.validate()) return
    setSubmitting(true)
    try {
      await persist(data)
      await invalidateEmployees()
      exitForm()
    } catch (error) {
      toast.error(failure(error))
    } finally {
      setSubmitting(false)
    }
  }

  const setActive = (active: boolean) => {
    form.setValue('is_active', active)
    form.setValue('terminated_at', active ? '' : isoDate())
  }

  return { form, access, cashboxId, setCashboxId, setActive, submitting, onSubmit: form.handleSubmit(submit), exitForm }
}

export type EmployeeFormState = ReturnType<typeof useEmployeeForm>
