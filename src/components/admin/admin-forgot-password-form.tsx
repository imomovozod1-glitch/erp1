'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ShieldCheck, Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const schema = z.object({ email: z.string().email() })
type FormData = z.infer<typeof schema>

/**
 * Super-admin self-service password recovery. Uses Supabase's standard
 * `resetPasswordForEmail` — this is only viable for super-admins because
 * they have a real inbox behind their login email, unlike tenant users
 * (whose login is a synthetic `{phone}@tenant.local` address with no real
 * mailbox — see `phoneToSyntheticEmail` in src/lib/tenant-auth.ts). Always
 * shows the same success message regardless of whether the email exists,
 * matching Supabase's own no-enumeration behavior.
 */
export function AdminForgotPasswordForm() {
  const t = useTranslations('admin.accountRecovery')
  const tLogin = useTranslations('admin.login')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      })
    } finally {
      setIsLoading(false)
      setSent(true)
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
            <h1 className="text-white font-bold text-xl leading-none">{tLogin('brandTitle')}</h1>
            <p className="text-slate-400 text-xs mt-0.5">{tLogin('brandSubtitle')}</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">{t('forgotTitle')}</h2>
          <p className="text-slate-400 text-sm mt-1">{t('forgotSubtitle')}</p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-200 leading-relaxed">{t('checkEmail')}</p>
            </div>
            <Link
              href="/admin/login"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t('backToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-300 text-sm">{tLogin('email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder={tLogin('emailPlaceholder')}
                  {...register('email')}
                  className={cn(
                    'pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11',
                    errors.email && 'border-red-500/50'
                  )}
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs">{tLogin('emailInvalid')}</p>}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 mt-2"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('sending')}</>
              ) : t('sendLink')}
            </Button>

            <Link
              href="/admin/login"
              className="flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors pt-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t('backToLogin')}
            </Link>
          </form>
        )}
      </div>

      <div className="absolute -inset-1 bg-[linear-gradient-to-r] from-violet-500/20 to-purple-500/20 rounded-2xl blur-xl -z-10" />
    </div>
  )
}
