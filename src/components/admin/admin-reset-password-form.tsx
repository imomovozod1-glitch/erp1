'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldCheck, Loader2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { newPasswordSchema } from '@/lib/password-validation'
import Link from 'next/link'

/**
 * Landing page for the email link from `AdminForgotPasswordForm`. Supabase's
 * browser client (`detectSessionInUrl: true` by default in `@supabase/ssr`)
 * exchanges the recovery code in the URL for a session automatically; we
 * just listen for the `PASSWORD_RECOVERY` auth event to know when it's safe
 * to show the form, and treat "never fires" (bad/expired/already-used link)
 * as an error state after a short grace period rather than hanging forever.
 */
export function AdminResetPasswordForm() {
  const t = useTranslations('admin.accountRecovery')
  const tAuth = useTranslations('auth')
  const tPassword = useTranslations('admin.password')
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const schema = z
    .object({
      password: newPasswordSchema(tAuth('passwordRequirements')),
      confirmPassword: newPasswordSchema(tAuth('passwordRequirements')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: tAuth('passwordMismatch'),
      path: ['confirmPassword'],
    })
  type FormData = z.infer<typeof schema>

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    const supabase = createClient()
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready')
    })
    // A session may already be present if this effect re-runs after the
    // initial exchange (e.g. fast refresh) — treat that as ready too.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus((s) => (s === 'checking' ? 'ready' : s))
    })
    const timeout = setTimeout(() => setStatus((s) => (s === 'checking' ? 'invalid' : s)), 6000)
    return () => {
      subscription.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: data.password })
      if (error) throw error
      toast.success(t('updateSuccess'))
      router.replace('/admin/login')
    } catch (error: any) {
      toast.error(error?.message || t('invalidOrExpiredLink'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative">
      <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-violet-500/20 rounded-xl border border-violet-500/30">
            <ShieldCheck className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-none">{t('newPasswordTitle')}</h1>
            <p className="text-slate-400 text-xs mt-0.5">{t('newPasswordSubtitle')}</p>
          </div>
        </div>

        {status === 'checking' && (
          <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {status === 'invalid' && (
          <div className="space-y-6">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200 leading-relaxed">{t('invalidOrExpiredLink')}</p>
            </div>
            <Link
              href="/admin/forgot-password"
              className="block text-center text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              {t('forgotTitle')}
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-300 text-sm">{tAuth('password')}</Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                showLabel={tPassword('show')}
                hideLabel={tPassword('hide')}
                {...register('password')}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11"
              />
              {errors.password ? (
                <p className="text-red-400 text-xs">{errors.password.message}</p>
              ) : (
                <p className="text-slate-500 text-xs">{tAuth('passwordRequirements')}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-slate-300 text-sm">{tAuth('confirmPassword')}</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="••••••••"
                showLabel={tPassword('show')}
                hideLabel={tPassword('hide')}
                {...register('confirmPassword')}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11"
              />
              {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 mt-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t('updatePassword')}
            </Button>
          </form>
        )}
      </div>

      <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-2xl blur-xl -z-10" />
    </div>
  )
}
