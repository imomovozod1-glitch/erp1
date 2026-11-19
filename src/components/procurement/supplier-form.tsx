'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { CreditCard, FileText, Mail, Phone, Truck, User } from 'lucide-react'
import { toast } from 'sonner'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Textarea } from '@/components/ui/textarea'
import { AddressField } from '@/components/shared/address-field'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { FormFooter } from '@/components/shared/form-footer'
import { LabeledField } from '@/components/shared/labeled-field'
import { StatusField } from '@/components/inventory/catalog-form/catalog-fields'
import { createClient } from '@/lib/supabase/client'
import { invalidateSuppliers } from '@/lib/data/revalidate'
import { errorMessage } from '@/lib/error-message'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { phoneSchema } from '@/lib/phone-validation'

const optionalText = z.string().optional().or(z.literal(''))

const supplierSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('common.required')),
    phone: phoneSchema(t('auth.invalidPhone')),
    email: z.string().email(t('common.invalidEmail')).optional().or(z.literal('')),
    address: optionalText,
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    contact_person: optionalText,
    tin: optionalText,
    notes: optionalText,
    is_active: z.boolean(),
  })

type SupplierData = z.infer<ReturnType<typeof supplierSchema>>

const supplierDefaults = (initial: any): SupplierData => ({
  name: initial?.name || '',
  phone: initial?.phone || '',
  email: initial?.email || '',
  address: initial?.address || '',
  latitude: initial?.latitude ?? null,
  longitude: initial?.longitude ?? null,
  contact_person: initial?.contact_person || '',
  tin: initial?.tin || '',
  notes: initial?.notes || '',
  is_active: initial?.is_active ?? true,
})

const orNull = (value?: string | null) => value || null

async function saveSupplier(data: SupplierData, initial: any, assignedTo: string | null) {
  const supabase = createClient() as any
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id ?? null
  const payload = {
    assigned_to: assignedTo ?? initial?.assigned_to ?? userId,
    created_by: initial?.created_by ?? userId,
    name: data.name,
    phone: data.phone,
    email: orNull(data.email),
    address: orNull(data.address),
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    contact_person: orNull(data.contact_person),
    tin: orNull(data.tin),
    notes: orNull(data.notes),
    is_active: data.is_active,
  }
  const query = initial?.id ? supabase.from('suppliers').update(payload).eq('id', initial.id) : supabase.from('suppliers').insert([payload])
  const { error } = await query
  if (error) throw error
}

interface SupplierFormProps {
  assignableUsers: AssignableUser[]
  initialData?: any
  lang: string
}

export function SupplierForm({ initialData, lang, assignableUsers }: SupplierFormProps) {
  const t = useTranslations()
  const exitForm = useRouteModalExit(`/${lang}/procurement/suppliers`)
  const [submitting, setSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const form = useForm<SupplierData>({ resolver: zodResolver(supplierSchema(t)), defaultValues: supplierDefaults(initialData) })
  const { register, control, formState } = form
  const errors = formState.errors

  const submit = async (data: SupplierData) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await saveSupplier(data, initialData, assignedTo)
      toast.success(t(initialData?.id ? 'procurement.supplierUpdated' : 'procurement.supplierCreated'))
      await invalidateSuppliers()
      exitForm()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6 rounded-2xl border bg-card p-4 shadow-xs md:rounded-xl md:p-6">
      <header className="flex items-center gap-3 border-b pb-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-violet-600 dark:text-violet-400">
          <Truck className="size-5" />
        </span>
        <div>
          <h3 className="text-base font-bold text-foreground">{t('procurement.supplier')}</h3>
          <p className="text-xs text-muted-foreground">{t('procurement.addSupplier')}</p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <LabeledField id="name" label={t('procurement.supplierName')} icon={Truck} required error={errors.name?.message}>
          <Input id="name" {...register('name')} placeholder={t('procurement.supplierName')} />
        </LabeledField>
        <LabeledField id="phone" label={t('procurement.supplierPhone')} icon={Phone} required error={errors.phone?.message as string | undefined}>
          <Controller control={control} name="phone" render={({ field }) => <PhoneInput id="phone" value={field.value ?? ''} onChange={field.onChange} hasError={!!errors.phone} />} />
        </LabeledField>
        <LabeledField id="contact_person" label={t('procurement.contactPerson')} icon={User}>
          <Input id="contact_person" {...register('contact_person')} placeholder={t('procurement.contactPerson')} />
        </LabeledField>
        <LabeledField id="email" label={t('common.email')} icon={Mail} error={errors.email?.message}>
          <Input id="email" type="email" {...register('email')} placeholder="example@mail.com" />
        </LabeledField>
        <LabeledField id="tin" label={t('procurement.tin')} icon={CreditCard}>
          <Input id="tin" {...register('tin')} placeholder="123456789" />
        </LabeledField>
        <StatusField control={control} />
        <AddressField form={form} label={t('common.address')} placeholder={t('common.address')} className="md:col-span-2" />
        <LabeledField id="notes" label={t('common.notes')} icon={FileText} className="md:col-span-2">
          <Textarea id="notes" {...register('notes')} placeholder={t('common.notes')} rows={3} className="resize-none" />
        </LabeledField>
      </div>
      <div className="max-w-sm">
        <AssigneeSelect value={assignedTo} onChange={setAssignedTo} users={assignableUsers} />
      </div>
      <FormFooter>
        <Button type="button" variant="outline" onClick={() => exitForm()} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {t(submitting ? 'common.saving' : 'common.save')}
        </Button>
      </FormFooter>
    </form>
  )
}
