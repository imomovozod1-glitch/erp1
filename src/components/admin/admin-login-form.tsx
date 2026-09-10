'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { LocaleSwitcher } from '@/components/shared/locale-switcher'
import { AuthPortalLinks } from '@/components/auth/auth-portal-links'
import {
  AuthCard,
  AuthField,
  AuthSubmitButton,
  authInputClass,
  authInputErrorClass,
} from '@/components/auth/auth-card'
import { cn } from '@/lib/utils'

export function AdminLoginForm() {
  const t = useTranslations('admin.login')
  const tPassword = useTranslations('admin.password')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('emailInvalid')),
        password: z.string().min(1, t('passwordRequired')),
      }),
    [t]
  )
  type LoginForm = z.infer<typeof loginSchema>

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      })
      if (!res.ok) {
        toast.error(res.status === 429 ? t('tooManyAttempts') : t('invalidCredentials'))
        setIsLoading(false)
        return
      }
      router.replace('/admin/tenants')
      router.refresh()
    } catch {
      toast.error(t('invalidCredentials'))
      setIsLoading(false)
    }
  }

  return (
    <AuthCard
      icon={ShieldCheck}
      brandTitle={t('brandTitle')}
      brandSubtitle={t('brandSubtitle')}
      heading={t('heading')}
      subheading={t('subheading')}
      // Cookie mode: the console is fast-pathed past next-intl's middleware in
      // src/proxy.ts, so it has no `[lang]` URL segment to rewrite.
      behind={<AuthPortalLinks current="admin" />}
      action={<LocaleSwitcher mode="cookie" variant="glass" />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <AuthField id="email" label={t('email')} error={errors.email?.message}>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder={t('emailPlaceholder')}
              {...register('email')}
              className={cn('pl-10', authInputClass, errors.email && authInputErrorClass)}
            />
          </div>
        </AuthField>

        <AuthField
          id="password"
          label={t('password')}
          error={errors.password?.message}
          action={
            <Link href="/admin/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              {t('forgotPassword')}
            </Link>
          }
        >
          <PasswordInput
            id="password"
            placeholder="••••••••"
            autoComplete="current-password"
            showLabel={tPassword('show')}
            hideLabel={tPassword('hide')}
            {...register('password')}
            className={cn(authInputClass, errors.password && authInputErrorClass)}
          />
        </AuthField>

        <AuthSubmitButton isLoading={isLoading} label={t('signIn')} loadingLabel={t('signingIn')} />
      </form>
    </AuthCard>
  )
}
