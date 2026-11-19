'use client'

import { useTranslations } from 'next-intl'
import { describeFailure, rememberedTenantHost, rememberTenantHost, safeRedirectTo, type LoginFailure } from '@/components/auth/login-flow'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { PasswordInput } from '@/components/ui/password-input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { LocaleSwitcher } from '@/components/shared/locale-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import {
  AuthAlert,
  AuthAlertLink,
  AuthCard,
  AuthField,
  AuthSubmitButton,
  authInputClass,
  authInputErrorClass,
  authLinkClass,
  authPhoneInputClasses,
} from '@/components/auth/auth-card'
import { phoneSchema } from '@/lib/phone-validation'
import { getTenantSubdomain } from '@/lib/tenant-host'
import { cn } from '@/lib/utils'

export function LoginForm({ lang }: { lang: string }) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  // Kept on the page rather than in a toast: a refusal here often has an
  // address to follow, and a toast takes it away before it can be read.
  const [failure, setFailure] = useState<LoginFailure | null>(null)

  // On a host that serves no company there is nothing to sign in to, so a
  // device that has been here before is sent straight back to its own company
  // address — where its session already is.
  //
  // Only ever on such a host: landing on a company's address is a deliberate
  // act (someone typed it, or was handed the link), and redirecting away from
  // it would make signing in to a second company impossible.
  useEffect(() => {
    if (getTenantSubdomain(window.location.host)) return
    const params = new URLSearchParams(window.location.search)
    if (params.has('switch') || params.has('redirectTo')) return
    const host = rememberedTenantHost()
    if (!host || host === window.location.host) return
    // Straight to the workspace, not to that host's login: the session very
    // likely still lives there (this is a relaunch of the app, not a new
    // sign-in), and /login is served even to a signed-in visitor, so aiming
    // at the form would ask for a password that is not needed. If the session
    // has in fact expired, the middleware bounces to the login form on that
    // host — the right place to type it.
    window.location.replace(`${window.location.protocol}//${host}/${lang}/dashboard`)
  }, [lang])

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
    setFailure(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.phone, password: data.password }),
      })
      if (!res.ok) {
        setFailure(await describeFailure(res, t))
        setIsLoading(false)
        return
      }
      // Signed in on a host that serves no company: the session has already
      // been moved to the company's own address and dropped here, so follow
      // it (src/lib/tenant-handoff.ts). A full navigation, not router.replace
      // — it is a different origin.
      const json = await res.json().catch(() => null)
      if (json?.handoff?.url) {
        rememberTenantHost(json.handoff.host)
        window.location.replace(json.handoff.url)
        return
      }

      // Use replace so login isn't in the back-stack.
      // No router.refresh() needed — middleware re-validates on every request.
      rememberTenantHost(window.location.host)
      router.replace(safeRedirectTo(`/${lang}/dashboard`))
    } catch {
      setFailure({ message: t('invalidCredentials') })
      setIsLoading(false)
    }
  }

  return (
    <AuthCard
      icon={Building2}
      brandTitle="Falco"
      brandSubtitle={t('brandSubtitle')}
      heading={t('loginTitle')}
      subheading={t('loginSubtitle')}
      action={
        <>
          <ThemeToggle className="rounded-full" />
          <LocaleSwitcher mode="path" />
        </>
      }
    >
      {failure && (
        <AuthAlert>
          <p>{failure.message}</p>
          {failure.hint && <p className="text-xs opacity-80">{failure.hint}</p>}
          {failure.link && <AuthAlertLink href={failure.link.href}>{failure.link.label}</AuthAlertLink>}
        </AuthAlert>
      )}

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
                    className={authLinkClass}
                  />
                }
              >
                {t('forgotPassword')}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 text-sm leading-relaxed">
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
