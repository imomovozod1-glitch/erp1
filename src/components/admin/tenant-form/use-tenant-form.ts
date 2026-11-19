'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { addMonths } from '@/components/admin/preset-picker'
import { adminErrorMessage } from '@/lib/admin-errors'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { tenantBody, tenantDefaults, tenantSchema, type TenantFormData, type TenantFormInitialData, type TenantFormMode } from './tenant-schema'

export function useTenantForm(mode: TenantFormMode, initial?: TenantFormInitialData) {
  const t = useTranslations('admin.form')
  const tErrors = useTranslations('admin.errors')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const exitForm = useRouteModalExit('/admin/tenants')
  const [submitting, setSubmitting] = useState(false)
  const schema = useMemo(() => tenantSchema(mode, t, tAuth('passwordRequirements')), [mode, t, tAuth])
  const form = useForm<TenantFormData>({ resolver: zodResolver(schema), defaultValues: tenantDefaults(initial) })

  // The end date is derived, never typed: start + duration, recomputed when either changes.
  const recomputeEnd = (start?: string, months?: number) => {
    if (start && months) form.setValue('subscription_ends_at', addMonths(start, months), { shouldValidate: true })
  }
  const setDuration = (months: number) => {
    form.setValue('license_months', months, { shouldValidate: true })
    recomputeEnd(form.getValues('subscription_started_at'), months)
  }
  const setStart = (start: string) => {
    form.setValue('subscription_started_at', start, { shouldValidate: true })
    recomputeEnd(start, form.getValues('license_months'))
  }

  const submit = async (data: TenantFormData) => {
    setSubmitting(true)
    try {
      const res = await fetch(mode === 'create' ? '/api/admin/tenants' : `/api/admin/tenants/${initial!.id}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantBody(mode, data)),
      })
      const json = await res.json()
      if (!res.ok) return void toast.error(adminErrorMessage(tErrors, json, t('genericError')))
      toast.success(t(mode === 'create' ? 'createSuccess' : 'updateSuccess'))
      exitForm()
      router.refresh()
    } catch {
      toast.error(t('genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return { form, submitting, onSubmit: form.handleSubmit(submit), setDuration, setStart, exitForm }
}

export type TenantFormState = ReturnType<typeof useTenantForm>
