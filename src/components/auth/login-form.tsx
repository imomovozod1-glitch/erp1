'use client'

import { useTranslations } from 'next-intl'
import { lockMinutesFrom } from '@/lib/login-lock'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { PasswordInput } from '@/components/ui/password-input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { LocaleSwitcher } from '@/components/shared/locale-switcher'
import {
  AuthAlert,
  AuthAlertLink,
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

/** What the card shows when a sign-in is refused, and where to go instead. */
interface LoginFailure {
  message: string
  hint?: string
  link?: { href: string; label: string }
}

/**
 * Turns a refused sign-in into something the person can act on.
 *
 * The interesting cases are the ones the subdomains created: the credentials
 * are correct but belong to another company, or to a staff account that signs
 * in at its own portal (src/app/api/auth/login/route.ts). Both used to end as
 * "phone or password is wrong", which is the one thing they are not — so each
 * is named, and carries the address that would have worked.
 */
async function describeFailure(
  res: Response,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  lang: string
): Promise<LoginFailure> {
  const lockMinutes = await lockMinutesFrom(res)
  if (lockMinutes !== null) return { message: t('tooManyAttempts', { minutes: lockMinutes }) }

  const body = await res.json().catch(() => null)
  switch (body?.error) {
    case 'account_disabled':
      return { message: t('accountDisabled') }
    case 'staff_account':
      return {
        message: body.portal === 'admin' ? t('staffAccountAdmin') : t('staffAccountSupport'),
        ...(body.host
          ? {
              hint: t('staffAccountGoTo'),
              // `/login` on those hosts, not `/admin/login`: src/proxy.ts
              // rewrites the console's own address to its path tree.
              link: { href: `${window.location.protocol}//${body.host}/login`, label: body.host },
            }
          : {}),
      }
    case 'wrong_tenant':
      return {
        message: t('wrongTenant'),
        ...(body.host
          ? {
              hint: t('wrongTenantGoTo'),
              // Same scheme as the page being viewed, so this still works on
              // http://tenant.localhost:3000 in development.
              link: { href: `${window.location.protocol}//${body.host}/${lang}/login`, label: body.host },
            }
          : {}),
      }
    default:
      return { message: t('invalidCredentials') }
  }
}

export function LoginForm({ lang }: { lang: string }) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  // Kept on the page rather than in a toast: a refusal here often has an
  // address to follow, and a toast takes it away before it can be read.
  const [failure, setFailure] = useState<LoginFailure | null>(null)

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
        setFailure(await describeFailure(res, t, lang))
        setIsLoading(false)
        return
      }
      // Use replace so login isn't in the back-stack.
      // No router.refresh() needed — middleware re-validates on every request.
      router.replace(safeRedirectTo(`/${lang}/dashboard`))
    } catch {
      setFailure({ message: t('invalidCredentials') })
      setIsLoading(false)
    }
  }

  return (
    <AuthCard
      icon={Building2}
      brandTitle="Falco ERP"
      brandSubtitle="Enterprise Management"
      heading={t('loginTitle')}
      subheading={t('loginSubtitle')}
      action={<LocaleSwitcher mode="path" variant="glass" />}
    >
      {failure && (
        <AuthAlert>
          <p>{failure.message}</p>
          {failure.hint && <p className="text-red-200/70 text-xs">{failure.hint}</p>}
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
