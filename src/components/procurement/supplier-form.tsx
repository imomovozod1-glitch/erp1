'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateSuppliers } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SupplierFormProps {
  initialData?: any
  lang: string
}

export function SupplierForm({ initialData, lang }: SupplierFormProps) {
  const t = useTranslations('procurement')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formSchema = z.object({
    name: z.string().min(1, tCommon('required')),
    phone: z.string().min(1, tCommon('required')),
  })

  type FormData = z.infer<typeof formSchema>

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      phone: initialData?.phone || '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const supabase = createClient() as any

      if (initialData?.id) {
        const { error } = await supabase
          .from('suppliers')
          .update({ name: data.name, phone: data.phone } as any)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(t('supplierUpdated'))
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert([{ name: data.name, phone: data.phone } as any])
        if (error) throw error
        toast.success(t('supplierCreated'))
      }
      await invalidateSuppliers()
      router.push(`/${lang}/procurement/suppliers`)
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg bg-white p-6 rounded-xl border shadow-sm">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t('supplierName')} *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder={t('supplierName')}
            className="h-10"
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t('supplierPhone')} *</Label>
          <Input
            id="phone"
            {...register('phone')}
            placeholder="+998 90 123 45 67"
            className="h-10"
          />
          {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${lang}/procurement/suppliers`)}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500">
          {isSubmitting ? tCommon('loading') : tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
