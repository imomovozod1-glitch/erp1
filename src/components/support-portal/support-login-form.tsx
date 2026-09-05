'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { LifeBuoy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { PasswordInput } from '@/components/ui/password-input'
import { phoneSchema } from '@/lib/phone-validation'

export function SupportLoginForm() {
  const t = useTranslations('supportPortal')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const loginSchema = z.object({
    phone: phoneSchema(t('invalidCredentials')),
    password: z.string().min(1),
  })
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
    <div className="relative">
      <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-violet-500/20 rounded-xl border border-violet-500/30">
            <LifeBuoy className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-none">{t('brandTitle')}</h1>
            <p className="text-slate-400 text-xs mt-0.5">{t('brandSubtitle')}</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">{t('loginHeading')}</h2>
          <p className="text-slate-400 text-sm mt-1">{t('loginSubheading')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-slate-300 text-sm">{t('phone')}</Label>
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
                  triggerClassName="bg-white/5 border-white/10 text-white !h-11"
                  inputClassName="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11"
                  contentClassName="bg-slate-900 border border-white/10 text-white [&_[data-slot=select-item]]:text-white [&_[data-slot=select-item]]:focus:bg-white/10"
                />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-300 text-sm">{t('password')}</Label>
            <PasswordInput
              id="password"
              placeholder="••••••••"
              {...register('password')}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 mt-2"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('signingIn')}</>
            ) : t('signIn')}
          </Button>
        </form>
      </div>

      <div className="absolute -inset-1 bg-[linear-gradient-to-r] from-violet-500/20 to-purple-500/20 rounded-2xl blur-xl -z-10" />
    </div>
  )
}
