'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm, Resolver, Controller, useWatch } from 'react-hook-form'
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


interface InvoiceFormProps {
  initialData?: any
  customers: any[]
  orders?: any[]
  lang: string
}

export function InvoiceForm({ initialData, customers, orders = [], lang }: InvoiceFormProps) {
  const t = useTranslations()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase.auth])

  const innerFormSchema = z.object({
    invoice_number: z.string().min(1, t('common.required')),
    customer_id: z.string().min(1, t('common.required')),
    order_id: z.string().optional().or(z.literal('')),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
    total_amount: z.coerce.number().min(0),
    paid_amount: z.coerce.number().min(0),
    issued_at: z.string().optional().or(z.literal('')),
    due_at: z.string().min(1, t('common.required')),
    paid_at: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })

  type FormData = z.infer<typeof innerFormSchema>

  const [defaultInvoiceNumber] = useState(() => initialData?.invoice_number || `INV-${Date.now()}`)

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      invoice_number: defaultInvoiceNumber,
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
        toast.success(t('common.success'))
      } else {
        const { error } = await supabase
          .from('invoices')
          .insert([payload])
        if (error) throw error
        toast.success(t('common.success'))
      }
      
      await invalidateInvoices()
      router.push(`/${lang}/sales/invoices`)
    } catch (error: any) {
      toast.error(error.message || t('common.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusValue = useWatch({ control, name: 'status' })
  const customerIdValue = useWatch({ control, name: 'customer_id' })
  const orderIdValue = useWatch({ control, name: 'order_id' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl bg-white p-6 rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="invoice_number">{t('sales.invoiceNumber')} *</Label>
          <Input id="invoice_number" {...register('invoice_number')} />
          {errors.invoice_number && <p className="text-sm text-red-500">{errors.invoice_number.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_id">{t('sales.customer')} *</Label>
          <Select value={customerIdValue} onValueChange={(val) => { if (val) setValue('customer_id', val) }}>
            <SelectTrigger>
              <SelectValue placeholder={t('sales.selectCustomer')} />
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
          <Label htmlFor="order_id">{t('sales.orders')} ({t('common.optional')})</Label>
          <Select value={orderIdValue || 'none'} onValueChange={(val) => { if (val) setValue('order_id', val === 'none' ? '' : val) }}>
            <SelectTrigger>
              <SelectValue placeholder={t('sales.selectOrder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('common.none')}</SelectItem>
              {orders.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">{t('common.status')}</Label>
          <Select value={statusValue} onValueChange={(val: any) => setValue('status', val)}>
            <SelectTrigger>
              <SelectValue placeholder={t('sales.selectStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t('sales.status.draft')}</SelectItem>
              <SelectItem value="sent">{t('sales.status.sent')}</SelectItem>
              <SelectItem value="paid">{t('sales.status.paid')}</SelectItem>
              <SelectItem value="overdue">{t('sales.status.overdue')}</SelectItem>
              <SelectItem value="cancelled">{t('sales.status.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_amount">{t('common.total')}</Label>
          <Controller
            control={control}
            name="total_amount"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="total_amount" value={value} onChange={onChange} />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paid_amount">{t('sales.paidAmount')}</Label>
          <Controller
            control={control}
            name="paid_amount"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="paid_amount" value={value} onChange={onChange} />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="issued_at">{t('common.date')}</Label>
          <Input id="issued_at" type="date" {...register('issued_at')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_at">{t('sales.dueDate')} *</Label>
          <Input id="due_at" type="date" {...register('due_at')} />
          {errors.due_at && <p className="text-sm text-red-500">{errors.due_at.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="paid_at">{t('sales.paidDate')}</Label>
          <Input id="paid_at" type="date" {...register('paid_at')} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">{t('common.notes')}</Label>
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
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  )
}
