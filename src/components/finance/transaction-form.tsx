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
import { invalidateTransactions } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

interface TransactionFormProps {
  initialData?: any
  defaultType?: 'income' | 'expense'
  lang: string
}

export function TransactionForm({ initialData, defaultType = 'income', lang }: TransactionFormProps) {
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
    type: z.enum(['income', 'expense']),
    amount: z.coerce.number().min(0.01, t('common.required')),
    category: z.string().min(1, t('common.required')),
    transaction_date: z.string().min(1, t('common.required')),
    description: z.string().optional().or(z.literal('')),
    reference_type: z.string().optional().or(z.literal('')),
    reference_id: z.string().optional().or(z.literal('')),
  })

  type FormData = z.infer<typeof innerFormSchema>

  const { register, handleSubmit, setValue, control, formState: { errors } } = usePersistedForm<FormData>('transaction-form-v3', {
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      type: initialData?.type || defaultType,
      amount: initialData?.amount ?? '' as any,
      category: initialData?.category || '',
      transaction_date: initialData?.transaction_date ? initialData.transaction_date.split('T')[0] : '',
      description: initialData?.description || '',
      reference_type: initialData?.reference_type || '',
      reference_id: initialData?.reference_id || '',
    },
  })

  const onSubmit = async (data: any) => {
    if (!userId && !initialData) {
      toast.error(t('common.sessionNotFound'))
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        ...data,
        description: data.description || null,
        reference_type: data.reference_type || null,
        reference_id: data.reference_id || null,
        created_by: initialData?.created_by || userId,
      }

      if (initialData?.id) {
        const { error } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(t('common.success'))
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert([payload])
        if (error) throw error
        toast.success(t('common.success'))
      }
      
      await invalidateTransactions()
      clearPersistedForm('transaction-form-v3')
      if (initialData?.type || defaultType) {
        const redirectType = initialData?.type || defaultType
        router.push(`/${lang}/finance/${redirectType === 'income' ? 'income' : 'expenses'}`)
      } else {
        router.push(`/${lang}/finance/transactions`)
      }
    } catch (error: any) {
      toast.error(error.message || t('common.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const typeValue = useWatch({ control, name: 'type' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="type">{t('finance.type')} *</Label>
          <Select value={typeValue} onValueChange={(val: any) => setValue('type', val)}>
            <SelectTrigger>
              <SelectValue placeholder={t('finance.selectType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">{t('finance.incomeType')}</SelectItem>
              <SelectItem value="expense">{t('finance.expenseType')}</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && <p className="text-sm text-red-500">{errors.type.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">{t('common.amount')} *</Label>
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="amount" value={value} onChange={onChange} />
            )}
          />
          {errors.amount && <p className="text-sm text-red-500">{errors.amount.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">{t('finance.category')} *</Label>
          <Input id="category" placeholder={t('finance.categoryPlaceholder')} {...register('category')} />
          {errors.category && <p className="text-sm text-red-500">{errors.category.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="transaction_date">{t('common.date')} *</Label>
          <Input id="transaction_date" type="date" {...register('transaction_date')} />
          {errors.transaction_date && <p className="text-sm text-red-500">{errors.transaction_date.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reference_type">{t('finance.referenceType')} ({t('common.optional')})</Label>
          <Input id="reference_type" placeholder={t('finance.referenceTypePlaceholder')} {...register('reference_type')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reference_id">{t('finance.referenceId')} ({t('common.optional')})</Label>
          <Input id="reference_id" {...register('reference_id')} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">{t('common.description')} ({t('common.optional')})</Label>
          <Textarea id="description" {...register('description')} rows={3} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            const redirectType = initialData?.type || defaultType
            router.push(`/${lang}/finance/${redirectType === 'income' ? 'income' : 'expenses'}`)
          }}
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
