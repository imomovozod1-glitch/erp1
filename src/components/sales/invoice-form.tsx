'use client'

import { useState, useEffect } from 'react'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { Resolver, Controller, useWatch } from 'react-hook-form'
import { usePersistedForm, clearPersistedForm } from '@/lib/hooks/use-persisted-form'
import { NumericInput } from '@/components/ui/numeric-input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { invalidateInvoices } from '@/lib/data/revalidate'
import { reconcileInvoiceStatus } from '@/lib/statuses'
import { toast } from 'sonner'
import { adjustCashboxBalance } from '@/lib/finance-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'


interface InvoiceFormProps {
  /** Active tenant members who can be made responsible for the invoice. */
  assignableUsers: AssignableUser[]
  initialData?: any
  customers: any[]
  orders?: any[]
  lang: string
}

export function InvoiceForm({ initialData, customers, orders = [], assignableUsers, lang }: InvoiceFormProps) {
  const t = useTranslations('sales')
  const tCommon = useTranslations('common')
  const exitForm = useRouteModalExit(`/${lang}/sales/invoices`)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any
  const [userId, setUserId] = useState<string | null>(null)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase.auth])

  const innerFormSchema = z.object({
    invoice_number: z.string().min(1, tCommon('required')),
    customer_id: z.string().optional().or(z.literal('')),
    order_id: z.string().optional().or(z.literal('')),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
    total_amount: z.coerce.number().min(0),
    paid_amount: z.coerce.number().min(0),
    issued_at: z.string().min(1, tCommon('required')),
    due_at: z.string().min(1, tCommon('required')),
    paid_at: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })

  type FormData = z.infer<typeof innerFormSchema>

  const [defaultInvoiceNumber] = useState(() => initialData?.invoice_number || '')

  const { register, handleSubmit, setValue, control, formState: { errors } } = usePersistedForm<FormData>('invoice-form-v3', {
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      invoice_number: defaultInvoiceNumber,
      customer_id: initialData?.customer_id || '',
      order_id: initialData?.order_id || '',
      status: initialData?.status || 'draft',
      total_amount: initialData?.total_amount ?? '' as any,
      paid_amount: initialData?.paid_amount ?? '' as any,
      issued_at: initialData?.issued_at 
        ? initialData.issued_at.split('T')[0] 
        : new Date().toISOString().split('T')[0],
      due_at: initialData?.due_at ? initialData.due_at.split('T')[0] : '',
      paid_at: initialData?.paid_at ? initialData.paid_at.split('T')[0] : '',
      notes: initialData?.notes || '',
    },
  })

  const onSubmit = async (data: any) => {
    if (!userId && !initialData) {
      toast.error(lang === 'uz' ? 'Foydalanuvchi seansi topilmadi' : lang === 'ru' ? 'Сессия пользователя не найдена' : 'User session not found')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        ...data,
        customer_id: (data.customer_id && data.customer_id !== 'none') ? data.customer_id : null,
        order_id: data.order_id || null,
        issued_at: data.issued_at,
        paid_at: data.paid_at || null,
        created_by: initialData?.created_by || userId,
        // Responsible person; defaults to the creator so nothing is orphaned.
        assigned_to: assignedTo ?? initialData?.assigned_to ?? userId,
      }

      const oldPaidAmount = initialData ? (Number(initialData.paid_amount) || 0) : 0
      const newPaidAmount = Number(data.paid_amount) || 0
      const difference = newPaidAmount - oldPaidAmount
      // The paid amount is the single source of truth for "is this settled" —
      // see reconcileInvoiceStatus.
      payload.status = reconcileInvoiceStatus(data.status, data.total_amount, newPaidAmount)

      let invoiceId = initialData?.id

      if (initialData?.id) {
        const { error } = await supabase
          .from('invoices')
          .update(payload)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(tCommon('success'))
      } else {
        const { data: newInvoice, error } = await supabase
          .from('invoices')
          .insert([payload])
          .select()
          .single()
        if (error) throw error
        invoiceId = newInvoice?.id
        toast.success(tCommon('success'))
      }

      if (difference !== 0) {
        await adjustCashboxBalance(Math.abs(difference), difference > 0 ? 'income' : 'expense', supabase)
        const categoryLabel = lang === 'uz' ? 'Faktura to\'lovi' : lang === 'ru' ? 'Оплата по счету' : 'Invoice Payment'
        await supabase.from('transactions').insert({
          type: difference > 0 ? 'income' : 'expense',
          amount: Math.abs(difference),
          category: categoryLabel,
          description: `${categoryLabel} #${data.invoice_number}`,
          reference_type: 'invoices',
          reference_id: invoiceId,
          transaction_date: data.paid_at || data.issued_at,
          created_by: initialData?.created_by || userId,
        })
      }

      await invalidateInvoices()
      clearPersistedForm('invoice-form-v3')
      exitForm()
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusValue = useWatch({ control, name: 'status' })
  const customerIdValue = useWatch({ control, name: 'customer_id' })
  const orderIdValue = useWatch({ control, name: 'order_id' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="invoice_number">{t('invoiceNumber')} *</Label>
          <Input id="invoice_number" {...register('invoice_number')} />
          {errors.invoice_number && <p className="text-sm text-red-500">{errors.invoice_number.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_id">{t('customer')}</Label>
          <Select value={customerIdValue || 'none'} onValueChange={(val) => setValue('customer_id', val || '')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectCustomer')}>
                {customerIdValue && customerIdValue !== 'none'
                  ? customers.find((c) => c.id === customerIdValue)?.name
                  : tCommon('none')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{tCommon('none')}</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.customer_id && <p className="text-sm text-red-500">{errors.customer_id.message}</p>}
        </div>

        <div className="space-y-2">
          <AssigneeSelect value={assignedTo} onChange={setAssignedTo} users={assignableUsers} currentUserId={userId} />
        </div>


        <div className="space-y-2">
          <Label htmlFor="order_id">{t('orders')} ({tCommon('optional')})</Label>
          <Select value={orderIdValue || 'none'} onValueChange={(val) => { if (val) setValue('order_id', val === 'none' ? '' : val) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectOrder')}>
                {orderIdValue && orderIdValue !== 'none'
                  ? orders.find((o) => o.id === orderIdValue)?.order_number
                  : tCommon('none')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{tCommon('none')}</SelectItem>
              {orders.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">{tCommon('status')}</Label>
          <Select value={statusValue} onValueChange={(val: any) => setValue('status', val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectStatus')}>
                {statusValue ? t(`status.${statusValue}`) : ''}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {/* `paid` and `overdue` are not picked by hand: paid follows the
                  paid amount below, overdue follows the due date. */}
              <SelectItem value="draft">{t('status.draft')}</SelectItem>
              <SelectItem value="sent">{t('status.sent')}</SelectItem>
              <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_amount">{tCommon('total')}</Label>
          <Controller
            control={control}
            name="total_amount"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="total_amount" value={value} onChange={onChange} />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paid_amount">{t('paidAmount')}</Label>
          <Controller
            control={control}
            name="paid_amount"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="paid_amount" value={value} onChange={onChange} />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="issued_at">{tCommon('date')} *</Label>
          <Controller
            control={control}
            name="issued_at"
            render={({ field }) => (
              <DatePicker
                id="issued_at"
                value={field.value}
                onChange={field.onChange}
                lang={lang}
                placeholder={tCommon('date')}
              />
            )}
          />
          {errors.issued_at && <p className="text-sm text-red-500">{errors.issued_at.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_at">{t('dueDate')} *</Label>
          <Controller
            control={control}
            name="due_at"
            render={({ field }) => (
              <DatePicker
                id="due_at"
                value={field.value}
                onChange={field.onChange}
                lang={lang}
                placeholder={t('dueDate')}
              />
            )}
          />
          {errors.due_at && <p className="text-sm text-red-500">{errors.due_at.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="paid_at">{t('paidDate')}</Label>
          <Controller
            control={control}
            name="paid_at"
            render={({ field }) => (
              <DatePicker
                id="paid_at"
                value={field.value}
                onChange={field.onChange}
                lang={lang}
                placeholder={t('paidDate')}
              />
            )}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">{tCommon('notes')}</Label>
          <Textarea id="notes" {...register('notes')} rows={3} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => exitForm()}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
