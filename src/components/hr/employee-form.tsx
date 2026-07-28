'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm, Controller } from 'react-hook-form'
import { NumericInput } from '@/components/ui/numeric-input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { invalidateEmployees } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Resolver } from 'react-hook-form'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

const formSchema = z.object({
  employee_code: z.string().min(1, 'Required'),
  position: z.string().min(1, 'Required'),
  salary: z.coerce.number().min(0),
  hired_at: z.string(),
  is_active: z.boolean(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface EmployeeFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any
  lang: string
}

export function EmployeeForm({ initialData, lang }: EmployeeFormProps) {
  const t = useTranslations('hr')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const innerFormSchema = z.object({
    employee_code: z.string().min(1, tCommon('required')),
    position: z.string().min(1, tCommon('required')),
    salary: z.coerce.number().min(0, tCommon('invalidAmount')),
    hired_at: z.string().min(1, tCommon('required')),
    is_active: z.boolean().default(true),
    notes: z.string().optional(),
  })

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      employee_code: initialData?.employee_code || '',
      position: initialData?.position || '',
      salary: initialData?.salary || 0,
      hired_at: initialData?.hired_at ? initialData.hired_at.split('T')[0] : new Date().toISOString().split('T')[0],
      is_active: initialData?.is_active ?? true,
      notes: initialData?.notes || '',
    }
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      if (initialData?.id) {
        const { error } = await supabase
          .from('employees')
          .update(data as any)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(tCommon('saved'))
      } else {
        const { error } = await supabase
          .from('employees')
          .insert(data as any)
        if (error) throw error
        toast.success(tCommon('created'))
      }
      
      await invalidateEmployees()
      router.push(`/${lang}/hr/employees`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? tCommon('edit') : tCommon('add')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee_code">{t('employeeCode')}</Label>
              <Input id="employee_code" {...register('employee_code')} />
              {errors.employee_code && (
                <p className="text-sm text-red-500">{errors.employee_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">{t('position')}</Label>
              <Input id="position" {...register('position')} />
              {errors.position && (
                <p className="text-sm text-red-500">{errors.position.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary">{t('salary')}</Label>
              <Controller
                control={control}
                name="salary"
                render={({ field: { onChange, value } }) => (
                  <NumericInput id="salary" value={value} onChange={onChange} />
                )}
              />
              {errors.salary && (
                <p className="text-sm text-red-500">{errors.salary.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hired_at">{t('hiredAt')}</Label>
              <Input id="hired_at" type="date" {...register('hired_at')} />
              {errors.hired_at && (
                <p className="text-sm text-red-500">{errors.hired_at.message}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea id="notes" {...register('notes')} />
            {errors.notes && (
              <p className="text-sm text-red-500">{errors.notes.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="is_active" 
              checked={watch('is_active')}
              onCheckedChange={(checked) => setValue('is_active', checked as boolean)}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              {t('isActive')}
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.push(`/${lang}/hr/employees`)}
              disabled={isSubmitting}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
