'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { newPasswordSchema } from '@/lib/password-validation'
import { changeOwnPassword } from '@/lib/change-password'

export function SecurityForm() {
  const t = useTranslations('settings')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const securitySchema = z.object({
    currentPassword: z.string().min(1, tAuth('currentPasswordRequired')),
    password: newPasswordSchema(tAuth('passwordRequirements')),
    confirmPassword: newPasswordSchema(tAuth('passwordRequirements')),
  }).refine((data) => data.password === data.confirmPassword, {
    message: tAuth('passwordMismatch'),
    path: ['confirmPassword'],
  })

  type FormData = z.infer<typeof securitySchema>

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      currentPassword: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const result = await changeOwnPassword(supabase, data.currentPassword, data.password)
      if (!result.ok) {
        if (result.reason === 'wrong-current') {
          setError('currentPassword', { message: tAuth('currentPasswordWrong') })
          return
        }
        throw new Error(result.message || tCommon('error'))
      }

      toast.success(tAuth('passwordChangedSignedOutOthers'))
      reset()
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="max-w-3xl border-slate-200/60 dark:border-slate-800 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">{t('security')}</CardTitle>
        <CardDescription>{t('securityDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{tAuth('currentPassword')} *</Label>
            <PasswordInput
              id="currentPassword"
              placeholder="••••••••"
              autoComplete="current-password"
              showLabel={tAuth('showPassword')}
              hideLabel={tAuth('hidePassword')}
              {...register('currentPassword')}
              className="border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
            />
            {errors.currentPassword && (
              <p className="text-sm text-red-500">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{tAuth('newPassword')} *</Label>
            <PasswordInput
              id="password"
              placeholder="••••••••"
              showLabel={tAuth('showPassword')}
              hideLabel={tAuth('hidePassword')}
              {...register('password')}
              className="border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
            />
            {errors.password ? (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">{tAuth('passwordRequirements')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{tAuth('confirmPassword')} *</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="••••••••"
              showLabel={tAuth('showPassword')}
              hideLabel={tAuth('hidePassword')}
              {...register('confirmPassword')}
              className="border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-violet-600 hover:bg-violet-700 text-white transition-colors px-6 shadow-sm"
            >
              {isSubmitting ? tCommon('loading') : tCommon('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
