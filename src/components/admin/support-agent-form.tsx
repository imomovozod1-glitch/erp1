'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, User, Phone, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent } from '@/components/ui/card'
import { phoneSchema } from '@/lib/phone-validation'
import { newPasswordSchema } from '@/lib/password-validation'

export interface SupportAgentFormInitialData {
  id: string
  full_name: string
  phone: string
}

interface SupportAgentFormProps {
  mode: 'create' | 'edit'
  initialData?: SupportAgentFormInitialData
}

export function SupportAgentForm({ mode, initialData }: SupportAgentFormProps) {
  const t = useTranslations('admin.support.form')
  const tPassword = useTranslations('admin.password')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formSchema = z.object({
    full_name: z.string().min(1, t('fullNameRequired')),
    phone: phoneSchema(t('phoneInvalid')),
    password:
      mode === 'create'
        ? newPasswordSchema(tAuth('passwordRequirements'))
        : z.union([newPasswordSchema(tAuth('passwordRequirements')), z.literal('')]).optional(),
  })
  type FormData = z.infer<typeof formSchema>

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: initialData?.full_name ?? '',
      phone: initialData?.phone ?? '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(
        mode === 'create' ? '/api/admin/support-agents' : `/api/admin/support-agents/${initialData!.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('genericError'))
        setIsSubmitting(false)
        return
      }
      toast.success(mode === 'create' ? t('createSuccess') : t('updateSuccess'))
      router.push('/admin/support')
      router.refresh()
    } catch {
      toast.error(t('genericError'))
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 max-w-3xl">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" /> {t('fullName')}
            </Label>
            <Input id="full_name" {...register('full_name')} />
            {errors.full_name && <p className="text-sm text-red-500">{errors.full_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {t('phone')}
            </Label>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  id="phone"
                  placeholder={t('phonePlaceholder')}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  hasError={!!errors.phone}
                />
              )}
            />
            {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> {t('password')}
            </Label>
            <PasswordInput
              id="password"
              placeholder={t('passwordPlaceholder')}
              showLabel={tPassword('show')}
              hideLabel={tPassword('hide')}
              {...register('password')}
            />
            {errors.password ? (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{tAuth('passwordRequirements')}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-500">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === 'create' ? t('create') : t('save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/admin/support')}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
