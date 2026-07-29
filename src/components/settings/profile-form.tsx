'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateProfile } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Profile } from '@/types/database.types'

interface ProfileFormProps {
  profile: Profile | null
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any

  const profileSchema = z.object({
    full_name: z.string().min(1, tCommon('required')),
    phone: z.string().optional().nullable(),
  })

  type FormData = z.infer<typeof profileSchema>

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
    },
  })

  const onSubmit = async (data: FormData) => {
    if (!profile) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone,
        })
        .eq('id', profile.id)

      if (error) throw error

      await invalidateProfile(profile.id)
      toast.success(tCommon('success'))
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleLabels: Record<string, string> = {
    admin: t('role.admin'),
    manager: t('role.manager'),
    staff: t('role.staff'),
  }

  return (
    <Card className="max-w-2xl border-slate-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-800">{t('profile')}</CardTitle>
        <CardDescription>{tCommon('edit')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-600 font-medium">Email</Label>
              <Input value={profile?.email || ''} disabled className="bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed" />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-medium">{t('role.admin') || 'Role'}</Label>
              <div className="h-9 flex items-center px-3 rounded-md bg-indigo-50/50 border border-indigo-100 text-indigo-700 text-sm font-semibold capitalize w-fit">
                {roleLabels[profile?.role || ''] || profile?.role || 'Staff'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-slate-600 font-medium">{tCommon('name')} *</Label>
            <Input id="full_name" {...register('full_name')} placeholder={tCommon('name')} className="border-slate-200" />
            {errors.full_name && <p className="text-sm text-red-500">{errors.full_name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-slate-600 font-medium">{t('companyPhone') || 'Phone'}</Label>
            <Input id="phone" {...register('phone')} placeholder="+998901234567" className="border-slate-200" />
            {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors px-6 shadow-sm">
              {isSubmitting ? tCommon('loading') : tCommon('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
