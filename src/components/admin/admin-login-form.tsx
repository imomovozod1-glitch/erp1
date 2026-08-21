'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { AdminLocaleSwitcher } from '@/components/admin/admin-locale-switcher'
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
    <div className="relative">
      <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
              <ShieldCheck className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-none">{t('brandTitle')}</h1>
              <p className="text-slate-400 text-xs mt-0.5">{t('brandSubtitle')}</p>
            </div>
          </div>
          <AdminLocaleSwitcher />
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">{t('heading')}</h2>
          <p className="text-slate-400 text-sm mt-1">{t('subheading')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-300 text-sm">{t('email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                {...register('email')}
                className={cn(
                  'pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 h-11',
                  errors.email && 'border-red-500/50'
                )}
              />
            </div>
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-300 text-sm">{t('password')}</Label>
            <PasswordInput
              id="password"
              placeholder="••••••••"
              showLabel={tPassword('show')}
              hideLabel={tPassword('hide')}
              {...register('password')}
              className={cn(
                'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 h-11',
                errors.password && 'border-red-500/50'
              )}
            />
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 mt-2"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('signingIn')}</>
            ) : t('signIn')}
          </Button>
        </form>
      </div>

      <div className="absolute -inset-1 bg-[linear-gradient-to-r] from-indigo-500/20 to-purple-500/20 rounded-2xl blur-xl -z-10" />
    </div>
  )
}
