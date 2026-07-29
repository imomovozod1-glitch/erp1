'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function CompanyForm() {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const [isMounted, setIsMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true)
  }, [])

  const companySchema = z.object({
    name: z.string().min(1, tCommon('required')),
    email: z.string().email(t('companyEmail') || 'Invalid email').or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
  })

  type FormData = z.infer<typeof companySchema>

  // Load initial values from localStorage (safe on client after mounting)
  const getSavedSettings = (): FormData => {
    if (typeof window === 'undefined') return { name: '', email: '', phone: '', address: '' }
    try {
      const saved = localStorage.getItem('company_settings')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error(e)
    }
    return { name: '', email: '', phone: '', address: '' }
  }

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(companySchema),
    values: isMounted ? getSavedSettings() : undefined, // only load values once mounted on client
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 600))
      localStorage.setItem('company_settings', JSON.stringify(data))
      toast.success(tCommon('success'))
    } catch {
      toast.error(tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isMounted) {
    return (
      <Card className="max-w-2xl border-slate-200/60 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl border-slate-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-800">{t('company')}</CardTitle>
        <CardDescription>{t('company') || 'Configure your company details'}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t('companyName')} *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g. Acme Corp"
              className="border-slate-200 focus-visible:ring-indigo-500"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email">{t('companyEmail')}</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="info@company.com"
                className="border-slate-200 focus-visible:ring-indigo-500"
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('companyPhone')}</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+998901234567"
                className="border-slate-200 focus-visible:ring-indigo-500"
              />
              {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t('companyAddress')}</Label>
            <Textarea
              id="address"
              {...register('address')}
              placeholder="123 Main St, City"
              rows={3}
              className="border-slate-200 focus-visible:ring-indigo-500"
            />
            {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors px-6 shadow-sm"
            >
              {isSubmitting ? tCommon('loading') : tCommon('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
