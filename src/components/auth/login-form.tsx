'use client'

import { useTranslations } from 'next-intl'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { PasswordInput } from '@/components/ui/password-input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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

/**
 * Where to land after a successful sign-in. `src/proxy.ts` appends
 * `?redirectTo=<path>` when it bounces an unauthenticated user off a
 * protected page, so a deep link survives the login round-trip instead of
 * dumping everyone on the dashboard.
 *
 * Only same-origin absolute paths are honoured — anything else (a full URL,
 * or the protocol-relative `//evil.com`, which a browser resolves as an
 * external host) is discarded, so the parameter can't be used to bounce a
 * freshly-authenticated user off-site.
 */
function safeRedirectTo(fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const target = new URLSearchParams(window.location.search).get('redirectTo')
  if (!target || !target.startsWith('/')) return fallback
  if (target.startsWith('//') || target.startsWith('/\\')) return fallback
  return target
}

export function LoginForm({ lang }: { lang: string }) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const loginSchema = useMemo(
    () =>
      z.object({
        phone: phoneSchema(t('invalidPhone')),
        password: z.string().min(6, t('passwordRequired')),
      }),
    [t]
  )
  type LoginForm = z.infer<typeof loginSchema>

  const { register, handleSubmit, control, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.phone, password: data.password }),
      })
      if (!res.ok) {
        toast.error(res.status === 429 ? t('tooManyAttempts') : t('invalidCredentials'))
        setIsLoading(false)
        return
      }
      // Use replace so login isn't in the back-stack.
      // No router.refresh() needed — middleware re-validates on every request.
      router.replace(safeRedirectTo(`/${lang}/dashboard`))
    } catch {
      toast.error(t('invalidCredentials'))
      setIsLoading(false)
    }
  }

  return (
    <AuthCard
      icon={Building2}
      brandTitle="ERP System"
      brandSubtitle="Enterprise Management"
      heading={t('loginTitle')}
      subheading={t('loginSubtitle')}
      behind={<AuthPortalLinks current="tenant" lang={lang} />}
      action={<LocaleSwitcher mode="path" variant="glass" />}
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

        <AuthField
          id="password"
          label={t('password')}
          error={errors.password?.message}
          action={
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  />
                }
              >
                {t('forgotPassword')}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 text-sm leading-relaxed bg-slate-900 border-white/10 text-slate-200">
                {t('forgotPasswordHint')}
              </PopoverContent>
            </Popover>
          }
        >
          <PasswordInput
            id="password"
            placeholder="••••••••"
            autoComplete="current-password"
            showLabel={t('showPassword')}
            hideLabel={t('hidePassword')}
            {...register('password')}
            className={cn(authInputClass, errors.password && authInputErrorClass)}
          />
        </AuthField>

        <AuthSubmitButton isLoading={isLoading} label={t('loginButton')} loadingLabel={t('loading')} />
      </form>
    </AuthCard>
  )
}
