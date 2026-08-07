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

interface OrderFormProps {
  initialData?: any
  customers: any[]
  lang: string
}

export function OrderForm({ initialData, customers, lang }: OrderFormProps) {
  const t = useTranslations('sales')
  const tCommon = useTranslations('common')
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
    order_number: z.string().min(1, tCommon('required')),
    customer_name: z.string().optional().or(z.literal('')),
    status: z.enum(['draft', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
    total_amount: z.coerce.number().min(0),
    discount_amount: z.coerce.number().min(0),
    tax_amount: z.coerce.number().min(0),
    order_date: z.string().optional().or(z.literal('')),
    delivery_date: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })

  type FormData = z.infer<typeof innerFormSchema>

  const [defaultOrderNumber] = useState(() => initialData?.order_number || '')

  const { register, handleSubmit, setValue, control, formState: { errors } } = usePersistedForm<FormData>('order-form-v3', {
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      order_number: defaultOrderNumber,
      customer_name: initialData?.customer_name || '',
      status: initialData?.status || 'draft',
      total_amount: initialData?.total_amount ?? '' as any,
      discount_amount: initialData?.discount_amount ?? '' as any,
      tax_amount: initialData?.tax_amount ?? '' as any,
      order_date: initialData?.order_date ? initialData.order_date.split('T')[0] : '',
      delivery_date: initialData?.delivery_date ? initialData.delivery_date.split('T')[0] : '',
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
        customer_id: (data.customer_name && data.customer_name !== 'none') ? data.customer_name : null,
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
      clearPersistedForm('order-form-v3')
      router.push(`/${lang}/sales/orders`)
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusValue = useWatch({ control, name: 'status' })
  const customerIdValue = useWatch({ control, name: 'customer_name' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl bg-white p-6 rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="order_number">{t('orderNumber')} *</Label>
          <Input id="order_number" {...register('order_number')} />
          {errors.order_number && <p className="text-sm text-red-500">{errors.order_number.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_name">{t('customer')}</Label>
          <Select value={customerIdValue || 'none'} onValueChange={(val) => setValue('customer_name', val || '')}>
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
          {errors.customer_name && <p className="text-sm text-red-500">{errors.customer_name.message}</p>}
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
              <SelectItem value="draft">{t('status.draft')}</SelectItem>
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
