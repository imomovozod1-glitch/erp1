'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateTransactionCategories } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TransactionCategoryFormProps {
  initialData?: any
  lang: string
}

export function TransactionCategoryForm({ initialData, lang }: TransactionCategoryFormProps) {
  const t = useTranslations('finance')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any

  const formSchema = z.object({
    name: z.string().min(1, tCommon('required')),
    type: z.enum(['income', 'expense']),
    person_type: z.enum(['employee', 'supplier', 'customer', 'none']),
  })

  type FormData = z.infer<typeof formSchema>

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      type: initialData?.type || 'expense',
      person_type: initialData?.person_type || 'none',
    },
  })

  const typeValue = watch('type')
  const personTypeValue = watch('person_type')

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      if (initialData?.id) {
        const { error } = await supabase
          .from('transaction_categories')
          .update(data)
          .eq('id', initialData.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('transaction_categories')
          .insert([data])
        if (error) throw error
      }
      toast.success(tCommon('success'))
      await invalidateTransactionCategories()
      router.push(`/${lang}/finance/categories`)
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-xl border shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="name">{tCommon('name')} *</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder={lang === 'uz' ? "Masalan: Ofis xarajatlari" : lang === 'ru' ? 'Например: Офисные расходы' : 'e.g. Office expenses'}
        />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">{t('type')} *</Label>
        <Select value={typeValue} onValueChange={(val: any) => setValue('type', val)}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">{t('incomeType')}</SelectItem>
            <SelectItem value="expense">{t('expenseType')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="person_type">{t('personType')}</Label>
        <Select value={personTypeValue} onValueChange={(val: any) => setValue('person_type', val)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('personTypeNone')}</SelectItem>
            <SelectItem value="employee">{t('personTypeEmployee')}</SelectItem>
            <SelectItem value="supplier">{t('personTypeSupplier')}</SelectItem>
            <SelectItem value="customer">{t('personTypeCustomer')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t('personTypeHint')}</p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${lang}/finance/categories`)}
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
