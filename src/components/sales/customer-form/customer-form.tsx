'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, type Resolver } from 'react-hook-form'
import { CreditCard, FileText, Mail, Phone, Tags, User } from 'lucide-react'
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
import { NameSelect } from '@/components/shared/name-select'
import { errorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { clearPersistedForm, usePersistedForm } from '@/lib/hooks/use-persisted-form'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { optionalPhoneSchema } from '@/lib/phone-validation'

const FORM_ID = 'customer-form-v3'
const optionalText = z.string().optional().or(z.literal(''))

const customerSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('common.required')),
    email: z.string().email(t('common.invalidEmail')).optional().or(z.literal('')),
    phone: optionalPhoneSchema(t('auth.invalidPhone')),
    address: optionalText,
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    tin: optionalText,
    notes: optionalText,
    category_id: z.string().optional().nullable(),
  })

type CustomerData = z.infer<ReturnType<typeof customerSchema>>

const customerDefaults = (initial: any): CustomerData => ({
  name: initial?.name || '',
  email: initial?.email || '',
  phone: initial?.phone || '',
  address: initial?.address || '',
  latitude: initial?.latitude ?? null,
  longitude: initial?.longitude ?? null,
  tin: initial?.tin || '',
  notes: initial?.notes || '',
  category_id: initial?.category_id || '',
})

async function saveCustomer(data: CustomerData, initial: any, assignedTo: string | null) {
  const supabase = createClient() as any
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id ?? null
  const payload = {
    assigned_to: assignedTo ?? initial?.assigned_to ?? userId,
    created_by: initial?.created_by ?? userId,
    ...data,
    category_id: data.category_id || null,
  }
  const query = initial?.id ? supabase.from('customers').update(payload).eq('id', initial.id) : supabase.from('customers').insert([payload])
  const { error } = await query
  if (error) throw error
}

interface CustomerFormProps {
  assignableUsers: AssignableUser[]
  initialData?: any
  categories?: { id: string; name: string }[]
  lang: string
}

export function CustomerForm({ initialData, categories = [], lang, assignableUsers }: CustomerFormProps) {
  const t = useTranslations()
  const exitForm = useRouteModalExit(`/${lang}/customers`)
  const [submitting, setSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const form = usePersistedForm<CustomerData>(FORM_ID, {
    resolver: zodResolver(customerSchema(t)) as unknown as Resolver<CustomerData>,
    defaultValues: customerDefaults(initialData),
  })
  const { register, control, formState } = form
  const errors = formState.errors

  const submit = async (data: CustomerData) => {
    setSubmitting(true)
    try {
      await saveCustomer(data, initialData, assignedTo)
      toast.success(t('common.success'))
      await invalidateCustomers()
      clearPersistedForm(FORM_ID)
      exitForm()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="mx-auto max-w-4xl space-y-6">
      <section className="space-y-6 rounded-xl border bg-card p-6 shadow-xs">
        <header className="flex items-center gap-2.5 border-b pb-2">
          <span className="rounded-lg bg-brand-subtle p-2 text-violet-600 dark:text-violet-400">
            <User className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-foreground">{t('sales.customer')}</h3>
            <p className="text-xs text-muted-foreground">{t('sales.customerSubtitle')}</p>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <LabeledField id="name" label={t('sales.customerName')} icon={User} required error={errors.name?.message}>
            <Input id="name" required {...register('name')} placeholder={t('sales.customerNamePlaceholder')} />
          </LabeledField>
          <LabeledField id="phone" label={t('sales.phone')} icon={Phone} error={errors.phone?.message as string | undefined}>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => <PhoneInput id="phone" value={field.value ?? ''} onChange={field.onChange} hasError={!!errors.phone} />}
            />
          </LabeledField>
          <LabeledField id="email" label={t('sales.email')} icon={Mail} error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} placeholder={t('sales.emailPlaceholder')} />
          </LabeledField>
          <LabeledField id="tin" label={t('sales.tin')} icon={CreditCard}>
            <Input id="tin" {...register('tin')} placeholder={t('sales.tinPlaceholder')} />
          </LabeledField>
          <LabeledField id="category_id" label={t('sales.category')} icon={Tags}>
            <Controller
              control={control}
              name="category_id"
              render={({ field }) => (
                <NameSelect
                  id="category_id"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={categories}
                  placeholder={t('common.select')}
                  clearLabel={t('common.select')}
                />
              )}
            />
          </LabeledField>
          <AddressField form={form} label={t('sales.address')} placeholder={t('sales.addressPlaceholder')} className="md:col-span-2" />
          <LabeledField id="notes" label={t('sales.notes')} icon={FileText} className="md:col-span-2">
            <Textarea id="notes" {...register('notes')} placeholder={t('sales.notesPlaceholder')} rows={3} className="resize-none" />
          </LabeledField>
        </div>
      </section>
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
