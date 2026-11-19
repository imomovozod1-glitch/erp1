'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { FormFooter } from '@/components/shared/form-footer'
import { FormAmountField, FormChoiceField, FormDateField, FormNameField } from '@/components/shared/form-controls'
import { LabeledField } from '@/components/shared/labeled-field'
import { failureMessage } from '@/lib/failure-message'
import { createClient } from '@/lib/supabase/client'
import { invalidateCashbox, invalidateInvoices } from '@/lib/data/revalidate'
import { useCurrentUserId } from '@/lib/hooks/use-current-user-id'
import { clearPersistedForm, usePersistedForm } from '@/lib/hooks/use-persisted-form'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { invoiceDefaults, invoiceSchema, type InvoiceFormData } from './invoice-form-model'
import { saveInvoice } from './invoice-save'

const FORM_ID = 'invoice-form-v3'
// `paid` follows the paid amount and `overdue` the due date, so neither is picked by hand.
const PICKABLE_STATUSES = ['draft', 'sent', 'cancelled'] as const

interface InvoiceFormProps {
  assignableUsers: AssignableUser[]
  initialData?: any
  customers: { id: string; name: string }[]
  orders?: { id: string; order_number: string }[]
  lang: string
}

export function InvoiceForm({ initialData, customers, orders = [], assignableUsers, lang }: InvoiceFormProps) {
  const t = useTranslations()
  const exitForm = useRouteModalExit(`/${lang}/sales/invoices`)
  const userId = useCurrentUserId()
  const [submitting, setSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const form = usePersistedForm<InvoiceFormData>(FORM_ID, {
    resolver: zodResolver(invoiceSchema(t('common.required'), t('common.invalidAmount'))) as unknown as Resolver<InvoiceFormData>,
    defaultValues: invoiceDefaults(initialData),
  })
  const { register, control, formState } = form
  const errors = formState.errors

  const submit = async (data: InvoiceFormData) => {
    if (!userId && !initialData) return void toast.error(t('common.sessionNotFound'))
    setSubmitting(true)
    try {
      const supabase = createClient()
      const paymentLabel = t('sales.invoicePaymentCategory')
      const moved = await saveInvoice({ supabase, data, initial: initialData, assignedTo, userId, paymentLabel })
      toast.success(t('common.success'))
      if (moved) void invalidateCashbox().catch(() => {})
      await invalidateInvoices()
      clearPersistedForm(FORM_ID)
      exitForm()
    } catch (error) {
      toast.error(failureMessage(t, error, t('common.error')))
    } finally {
      setSubmitting(false)
    }
  }

  const orderOptions = orders.map((o) => ({ id: o.id, name: o.order_number }))
  const statusOptions = PICKABLE_STATUSES.map((value) => ({ value, label: t(`sales.status.${value}`) }))

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6 rounded-2xl border bg-card p-4 shadow-sm md:rounded-xl md:p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <LabeledField id="invoice_number" label={t('sales.invoiceNumber')} required error={errors.invoice_number?.message}>
          <Input id="invoice_number" {...register('invoice_number')} />
        </LabeledField>
        <FormNameField control={control} name="customer_id" label={t('sales.customer')} options={customers} emptyLabel={t('common.none')} />
        <AssigneeSelect value={assignedTo} onChange={setAssignedTo} users={assignableUsers} currentUserId={userId} />
        <FormNameField
          control={control}
          name="order_id"
          label={`${t('sales.orders')} (${t('common.optional')})`}
          options={orderOptions}
          emptyLabel={t('common.none')}
        />
        <FormChoiceField control={control} name="status" label={t('common.status')} options={statusOptions} />
        <FormAmountField control={control} name="total_amount" label={t('common.total')} />
        <FormAmountField control={control} name="paid_amount" label={t('sales.paidAmount')} />
        <FormDateField control={control} name="issued_at" label={t('common.date')} required error={errors.issued_at?.message} lang={lang} />
        <FormDateField control={control} name="due_at" label={t('sales.dueDate')} required error={errors.due_at?.message} lang={lang} />
        <FormDateField control={control} name="paid_at" label={t('sales.paidDate')} lang={lang} />
        <LabeledField id="notes" label={t('common.notes')} className="md:col-span-2">
          <Textarea id="notes" {...register('notes')} rows={3} />
        </LabeledField>
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
