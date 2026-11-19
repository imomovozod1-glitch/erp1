'use client'

import { Controller, useWatch } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { FormFooter } from '@/components/shared/form-footer'
import { LabeledField } from '@/components/shared/labeled-field'
import { FormDateField, FormNameField } from '@/components/shared/form-controls'
import { SaleLinesEditor, type EditableSaleLine } from '@/components/sales/sale-lines-editor'
import { nextOrderStatuses } from '@/lib/statuses'
import { formatCurrency } from '@/lib/utils'
import { useOrderForm, type OrderFormState } from './use-order-form'

interface OrderFormProps {
  initialData?: any
  items?: EditableSaleLine[]
  customers: { id: string; name: string }[]
  assignableUsers: AssignableUser[]
  lang: string
}

// `cancelled` is left out on purpose: cancelling must return the goods to stock,
// which only the list's cancel action (cancelSalesOrder) does.
const statusChoices = (current: string) => [current, ...nextOrderStatuses(current).filter((next) => next !== 'cancelled')]

function StatusField({ state, current }: { state: OrderFormState; current: string }) {
  const t = useTranslations()
  const status = useWatch({ control: state.form.control, name: 'status' })
  return (
    <LabeledField id="status" label={t('common.status')}>
      <Select value={status} onValueChange={(value: any) => state.form.setValue('status', value)}>
        <SelectTrigger id="status" className="w-full">
          <SelectValue placeholder={t('sales.selectStatus')}>{status ? t(`sales.status.${status}`) : ''}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statusChoices(current).map((option) => (
            <SelectItem key={option} value={option}>
              {t(`sales.status.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </LabeledField>
  )
}

function TotalField({ state }: { state: OrderFormState }) {
  const t = useTranslations('common')
  return (
    <LabeledField id="total_amount" label={t('total')}>
      {state.hasLines ? (
        <Input id="total_amount" readOnly value={formatCurrency(state.total)} className="bg-muted font-semibold tabular-nums" />
      ) : (
        <Controller
          control={state.form.control}
          name="total_amount"
          render={({ field }) => <NumericInput id="total_amount" value={field.value} onChange={field.onChange} />}
        />
      )}
    </LabeledField>
  )
}

export function OrderForm({ initialData, items = [], customers, assignableUsers, lang }: OrderFormProps) {
  const t = useTranslations()
  const state = useOrderForm({ initial: initialData, lines: items, customers, lang })
  const { register, control, formState } = state.form

  return (
    <form onSubmit={state.onSubmit} className="space-y-6 rounded-2xl border bg-card p-4 shadow-sm md:rounded-xl md:p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <LabeledField id="order_number" label={t('sales.orderNumber')} required error={formState.errors.order_number?.message}>
          <Input id="order_number" {...register('order_number')} />
        </LabeledField>
        <FormNameField control={control} name="customer_name" label={t('sales.customer')} options={customers} emptyLabel={t('common.none')} />
        <AssigneeSelect value={state.assignedTo} onChange={state.setAssignedTo} users={assignableUsers} currentUserId={state.userId} />
        <StatusField state={state} current={initialData?.status ?? 'draft'} />
        <FormDateField control={control} name="order_date" label={t('sales.orderDate')} lang={lang} />
        <TotalField state={state} />
        <FormDateField control={control} name="delivery_date" label={t('sales.deliveryDate')} lang={lang} />
        <LabeledField id="notes" label={t('common.notes')} className="md:col-span-2">
          <Textarea id="notes" {...register('notes')} rows={3} />
        </LabeledField>
      </div>
      {state.hasLines && (
        <SaleLinesEditor
          lines={items}
          drafts={state.drafts}
          onChange={state.updateDraft}
          newTotal={state.total}
          oldTotal={state.oldTotal}
          disabled={state.submitting || initialData?.status === 'cancelled'}
        />
      )}
      <FormFooter>
        <Button type="button" variant="outline" onClick={() => state.exitForm()} disabled={state.submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={state.submitting}>
          {t(state.submitting ? 'common.saving' : 'common.save')}
        </Button>
      </FormFooter>
    </form>
  )
}
