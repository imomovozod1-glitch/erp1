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
import {
  AdminField,
  AdminFormActions,
  AdminFormSection,
  AdminFormShell,
} from '@/components/admin/admin-form-layout'
import { newPasswordSchema } from '@/lib/password-validation'
import { changeOwnPassword } from '@/lib/change-password'

export function AdminSecurityForm() {
  const t = useTranslations('admin.settings.security')
  const tPassword = useTranslations('admin.password')
  const tAuth = useTranslations('auth')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const schema = z
    .object({
      currentPassword: z.string().min(1, t('currentRequired')),
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
    setError,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const result = await changeOwnPassword(supabase, data.currentPassword, data.password)
      if (!result.ok) {
        if (result.reason === 'wrong-current') {
          setError('currentPassword', { message: t('currentWrong') })
          return
        }
        throw new Error(result.message || t('error'))
      }
      toast.success(t('successSignedOutOthers'))
      reset()
    } catch (error: any) {
      toast.error(error?.message || t('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminFormShell>
      <form onSubmit={handleSubmit(onSubmit)}>
        <AdminFormSection icon={ShieldCheck} title={t('title')} description={t('subtitle')}>
          <AdminField wide>
            <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
            <PasswordInput
              id="currentPassword"
              placeholder="••••••••"
              autoComplete="current-password"
              showLabel={tPassword('show')}
              hideLabel={tPassword('hide')}
              {...register('currentPassword')}
            />
            {errors.currentPassword && (
              <p className="text-sm text-red-500">{errors.currentPassword.message}</p>
            )}
          </AdminField>

          <AdminField>
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
          </AdminField>
          <AdminField>
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="••••••••"
              showLabel={tPassword('show')}
              hideLabel={tPassword('hide')}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
          </AdminField>
        </AdminFormSection>

        <AdminFormActions>
          <Button type="submit" disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-500 gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </AdminFormActions>
      </form>
    </AdminFormShell>
  )
}
