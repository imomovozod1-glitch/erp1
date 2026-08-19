'use client'

import { useTranslations } from 'next-intl'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { phoneToSyntheticEmail, formatPhoneInput } from '@/lib/tenant-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  phone: z.string().min(7).regex(/^\+?\d[\d\s-]*\d$/),
  password: z.string().min(6),
})
type LoginForm = z.infer<typeof loginSchema>

export function LoginForm({ lang }: { lang: string }) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const { register, handleSubmit, control, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: phoneToSyntheticEmail(data.phone),
        password: data.password,
      })
      if (error) {
        toast.error(t('invalidCredentials'))
        setIsLoading(false)
        return
      }
      // Use replace so login isn't in the back-stack.
      // No router.refresh() needed — middleware re-validates on every request.
      router.replace(`/${lang}/dashboard`)
    } catch {
      toast.error(t('invalidCredentials'))
      setIsLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Glass card */}
      <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
            <Building2 className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-none">ERP System</h1>
            <p className="text-slate-400 text-xs mt-0.5">Enterprise Management</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">{t('loginTitle')}</h2>
          <p className="text-slate-400 text-sm mt-1">{t('loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-slate-300 text-sm">{t('phone')}</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+998 90 123 45 67"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(formatPhoneInput(e.target.value))}
                    className={cn(
                      'pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 h-11',
                      errors.phone && 'border-red-500/50'
                    )}
                  />
                )}
              />
            </div>
            {errors.phone && (
              <p className="text-red-400 text-xs">{t('invalidPhone')}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-300 text-sm">{t('password')}</Label>
            <PasswordInput
              id="password"
              placeholder="••••••••"
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
              {...register('password')}
              className={cn(
                'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 h-11',
                errors.password && 'border-red-500/50'
              )}
            />
            {errors.password && (
              <p className="text-red-400 text-xs">{t('passwordRequired')}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 mt-2"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('loading')}</>
            ) : t('loginButton')}
          </Button>
        </form>

        {/* Decorative gradient */}
        <div className="absolute inset-0 rounded-2xl bg-[linear-gradient-to-tr] from-indigo-500/5 to-purple-500/5 pointer-events-none" />
      </div>

      {/* Background glow */}
      <div className="absolute -inset-1 bg-[linear-gradient-to-r] from-indigo-500/20 to-purple-500/20 rounded-2xl blur-xl -z-10" />
    </div>
  )
}
