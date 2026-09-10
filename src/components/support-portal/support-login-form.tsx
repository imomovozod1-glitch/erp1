'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { LifeBuoy } from 'lucide-react'
import { PhoneInput } from '@/components/ui/phone-input'
import { PasswordInput } from '@/components/ui/password-input'
import { LocaleSwitcher } from '@/components/shared/locale-switcher'
import { AuthPortalLinks } from '@/components/auth/auth-portal-links'
import {
  AuthCard,
  AuthField,
  AuthSubmitButton,
  authInputClass,
  authInputErrorClass,
  authPhoneInputClasses,
} from '@/components/auth/auth-card'
import { phoneSchema } from '@/lib/phone-validation'
import { cn } from '@/lib/utils'

export function SupportLoginForm() {
  const t = useTranslations('supportPortal')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const loginSchema = useMemo(
    () =>
      z.object({
        phone: phoneSchema(t('invalidPhone')),
        password: z.string().min(1, t('passwordRequired')),
      }),
    [t]
  )
  type LoginForm = z.infer<typeof loginSchema>

  const { control, register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/support/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        toast.error(res.status === 429 ? t('tooManyAttempts') : t('invalidCredentials'))
        setIsLoading(false)
        return
      }
      router.replace('/support')
      router.refresh()
    } catch {
      toast.error(t('invalidCredentials'))
      setIsLoading(false)
    }
  }

  return (
    <AuthCard
      icon={LifeBuoy}
      brandTitle={t('brandTitle')}
      brandSubtitle={t('brandSubtitle')}
      heading={t('loginHeading')}
      subheading={t('loginSubheading')}
      // Cookie mode: the portal is fast-pathed past next-intl's middleware in
      // src/proxy.ts, so it has no `[lang]` URL segment to rewrite.
      behind={<AuthPortalLinks current="support" />}
      action={<LocaleSwitcher mode="cookie" variant="glass" />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <AuthField id="phone" label={t('phone')} error={errors.phone?.message}>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                id="phone"
                placeholder="90 123 45 67"
                value={field.value ?? ''}
                onChange={field.onChange}
                hasError={!!errors.phone}
                {...authPhoneInputClasses}
              />
            )}
          />
        </AuthField>

        <AuthField id="password" label={t('password')} error={errors.password?.message}>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            autoComplete="current-password"
            showLabel={tAuth('showPassword')}
            hideLabel={tAuth('hidePassword')}
            {...register('password')}
            className={cn(authInputClass, errors.password && authInputErrorClass)}
          />
        </AuthField>

        <AuthSubmitButton isLoading={isLoading} label={t('signIn')} loadingLabel={t('signingIn')} />
      </form>
    </AuthCard>
  )
}
