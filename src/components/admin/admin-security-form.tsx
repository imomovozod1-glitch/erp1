'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { newPasswordSchema } from '@/lib/password-validation'

export function AdminSecurityForm() {
  const t = useTranslations('admin.settings.security')
  const tPassword = useTranslations('admin.password')
  const tAuth = useTranslations('auth')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const schema = z
    .object({
      password: newPasswordSchema(t('tooShort')),
      confirmPassword: newPasswordSchema(t('tooShort')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('mismatch'),
      path: ['confirmPassword'],
    })
  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: data.password })
      if (error) throw error
      toast.success(t('success'))
      reset()
    } catch (error: any) {
      toast.error(error?.message || t('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-violet-600" /> {t('title')}
        </CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('newPassword')}</Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                showLabel={tPassword('show')}
                hideLabel={tPassword('hide')}
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">{tAuth('passwordRequirements')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="••••••••"
                showLabel={tPassword('show')}
                hideLabel={tPassword('hide')}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-500 gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
