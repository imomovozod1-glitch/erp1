'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm, Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'



interface CustomerFormProps {
  initialData?: any
  lang: string
}

export function CustomerForm({ initialData, lang }: CustomerFormProps) {
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any

  const innerFormSchema = z.object({
    name: z.string().min(1, tCommon('required')),
    email: z.string().email(tCommon('invalidEmail')).optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    tin: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })

  type FormData = z.infer<typeof innerFormSchema>

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
      city: initialData?.city || '',
      tin: initialData?.tin || '',
      notes: initialData?.notes || '',
    },
  })

  const onSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      const payload = {
        ...data,
      }

      if (initialData?.id) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(tCommon('success'))
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([payload])
        if (error) throw error
        toast.success(tCommon('success'))
      }
      
      await invalidateCustomers()
      router.push(`/${lang}/sales/customers`)
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl bg-white p-6 rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Mijoz Ismi / Tashkilot nomi *</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" {...register('phone')} />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="city">Shahar</Label>
          <Input id="city" {...register('city')} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Manzil</Label>
          <Input id="address" {...register('address')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tin">STIR (TIN)</Label>
          <Input id="tin" {...register('tin')} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Eslatma (Notes)</Label>
          <Textarea id="notes" {...register('notes')} rows={3} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => router.push(`/${lang}/sales/customers`)}
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
