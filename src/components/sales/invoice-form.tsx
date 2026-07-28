'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm, Resolver, Controller } from 'react-hook-form'
import { NumericInput } from '@/components/ui/numeric-input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateInvoices } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const formSchema = z.object({
  invoice_number: z.string().min(1, 'Invoice number is required'),
  customer_id: z.string().min(1, 'Customer is required'),
  order_id: z.string().optional().or(z.literal('')),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  total_amount: z.coerce.number().min(0),
  paid_amount: z.coerce.number().min(0),
  issued_at: z.string().optional().or(z.literal('')),
  due_at: z.string().min(1, 'Due date is required'),
  paid_at: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof formSchema>

interface InvoiceFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customers: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orders?: any[]
  lang: string
}

export function InvoiceForm({ initialData, customers, orders = [], lang }: InvoiceFormProps) {
  const t = useTranslations('sales')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.auth.getUser().then(({ data }: any) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase.auth])

  const innerFormSchema = z.object({
    invoice_number: z.string().min(1, tCommon('required')),
    customer_id: z.string().min(1, tCommon('required')),
    order_id: z.string().optional().or(z.literal('')),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
    total_amount: z.coerce.number().min(0),
    paid_amount: z.coerce.number().min(0),
    issued_at: z.string().optional().or(z.literal('')),
    due_at: z.string().min(1, tCommon('required')),
    paid_at: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      invoice_number: initialData?.invoice_number || `INV-${Date.now()}`,
      customer_id: initialData?.customer_id || '',
      order_id: initialData?.order_id || '',
      status: initialData?.status || 'draft',
      total_amount: initialData?.total_amount || 0,
      paid_amount: initialData?.paid_amount || 0,
      issued_at: initialData?.issued_at ? initialData.issued_at.split('T')[0] : new Date().toISOString().split('T')[0],
      due_at: initialData?.due_at ? initialData.due_at.split('T')[0] : '',
      paid_at: initialData?.paid_at ? initialData.paid_at.split('T')[0] : '',
      notes: initialData?.notes || '',
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    if (!userId && !initialData) {
      toast.error('User session not found')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        ...data,
        order_id: data.order_id || null,
        issued_at: data.issued_at || null,
        paid_at: data.paid_at || null,
        created_by: initialData?.created_by || userId,
      }

      if (initialData?.id) {
        const { error } = await supabase
          .from('invoices')
          .update(payload)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(tCommon('success'))
      } else {
        const { error } = await supabase
          .from('invoices')
          .insert([payload])
        if (error) throw error
        toast.success(tCommon('success'))
      }
      
      await invalidateInvoices()
      router.push(`/${lang}/sales/invoices`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusValue = watch('status')
  const customerIdValue = watch('customer_id')
  const orderIdValue = watch('order_id')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl bg-white p-6 rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="invoice_number">{t('invoiceNumber')} *</Label>
          <Input id="invoice_number" {...register('invoice_number')} />
          {errors.invoice_number && <p className="text-sm text-red-500">{errors.invoice_number.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_id">{t('customer')} *</Label>
          <Select value={customerIdValue} onValueChange={(val) => { if (val) setValue('customer_id', val) }}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectCustomer')} />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.customer_id && <p className="text-sm text-red-500">{errors.customer_id.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="order_id">{t('orders')} ({tCommon('optional')})</Label>
          <Select value={orderIdValue || 'none'} onValueChange={(val) => { if (val) setValue('order_id', val === 'none' ? '' : val) }}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectOrder')} />
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
            <SelectTrigger>
              <SelectValue placeholder={t('selectStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t('status.draft')}</SelectItem>
              <SelectItem value="sent">{t('status.sent')}</SelectItem>
              <SelectItem value="paid">{t('status.paid')}</SelectItem>
              <SelectItem value="overdue">{t('status.overdue')}</SelectItem>
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
          <Label htmlFor="issued_at">{tCommon('date')}</Label>
          <Input id="issued_at" type="date" {...register('issued_at')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_at">{t('dueDate')} *</Label>
          <Input id="due_at" type="date" {...register('due_at')} />
          {errors.due_at && <p className="text-sm text-red-500">{errors.due_at.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="paid_at">{t('paidDate')}</Label>
          <Input id="paid_at" type="date" {...register('paid_at')} />
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
          onClick={() => router.push(`/${lang}/sales/invoices`)}
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
