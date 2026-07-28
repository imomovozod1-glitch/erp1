'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Resolver, Controller, useWatch } from 'react-hook-form'
import { usePersistedForm, clearPersistedForm } from '@/lib/hooks/use-persisted-form'
import { NumericInput } from '@/components/ui/numeric-input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateOrders } from '@/lib/data/revalidate'
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
  order_number: z.string().min(1, 'Order number is required'),
  customer_id: z.string().min(1, 'Customer is required'),
  status: z.enum(['draft', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
  total_amount: z.coerce.number().min(0),
  discount_amount: z.coerce.number().min(0),
  tax_amount: z.coerce.number().min(0),
  order_date: z.string().optional().or(z.literal('')),
  delivery_date: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof formSchema>

interface OrderFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customers: any[]
  lang: string
}

export function OrderForm({ initialData, customers, lang }: OrderFormProps) {
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
    order_number: z.string().min(1, tCommon('required')),
    customer_id: z.string().min(1, tCommon('required')),
    status: z.enum(['draft', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
    total_amount: z.coerce.number().min(0),
    discount_amount: z.coerce.number().min(0),
    tax_amount: z.coerce.number().min(0),
    order_date: z.string().optional().or(z.literal('')),
    delivery_date: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })

  const [defaultOrderNumber] = useState(() => initialData?.order_number || `ORD-${Date.now()}`)

  const { register, handleSubmit, setValue, control, formState: { errors } } = usePersistedForm<FormData>('order-form', {
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      order_number: defaultOrderNumber,
      customer_id: initialData?.customer_id || '',
      status: initialData?.status || 'draft',
      total_amount: initialData?.total_amount || 0,
      discount_amount: initialData?.discount_amount || 0,
      tax_amount: initialData?.tax_amount || 0,
      order_date: initialData?.order_date ? initialData.order_date.split('T')[0] : new Date().toISOString().split('T')[0],
      delivery_date: initialData?.delivery_date ? initialData.delivery_date.split('T')[0] : '',
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
        delivery_date: data.delivery_date || null,
        created_by: initialData?.created_by || userId,
      }

      if (initialData?.id) {
        const { error } = await supabase
          .from('sales_orders')
          .update(payload)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(tCommon('success'))
      } else {
        const { error } = await supabase
          .from('sales_orders')
          .insert([payload])
        if (error) throw error
        toast.success(tCommon('success'))
      }
      
      await invalidateOrders()
      clearPersistedForm('order-form')
      router.push(`/${lang}/sales/orders`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusValue = useWatch({ control, name: 'status' })
  const customerIdValue = useWatch({ control, name: 'customer_id' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl bg-white p-6 rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="order_number">{t('orderNumber')} *</Label>
          <Input id="order_number" {...register('order_number')} />
          {errors.order_number && <p className="text-sm text-red-500">{errors.order_number.message}</p>}
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
          <Label htmlFor="status">{tCommon('status')}</Label>
          <Select value={statusValue} onValueChange={(val: any) => setValue('status', val)}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t('status.draft')}</SelectItem>
              <SelectItem value="pending">{t('status.pending')}</SelectItem>
              <SelectItem value="confirmed">{t('status.confirmed')}</SelectItem>
              <SelectItem value="shipped">{t('status.shipped')}</SelectItem>
              <SelectItem value="delivered">{t('status.delivered')}</SelectItem>
              <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="order_date">{t('orderDate')}</Label>
          <Input id="order_date" type="date" {...register('order_date')} />
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
          <Label htmlFor="delivery_date">{t('deliveryDate')}</Label>
          <Input id="delivery_date" type="date" {...register('delivery_date')} />
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
          onClick={() => router.push(`/${lang}/sales/orders`)}
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
