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
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPhoneInput } from '@/lib/tenant-auth'
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
  })

  type FormData = z.infer<typeof profileSchema>

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
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
    <Card className="max-w-3xl border-slate-200/60 dark:border-slate-800 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">{t('profile')}</CardTitle>
        <CardDescription>{t('profileDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-slate-600 dark:text-slate-400 font-medium">{t('role.admin') || 'Role'}</Label>
            <div className="h-9 flex items-center px-3 rounded-md bg-violet-50/50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 text-violet-700 dark:text-violet-400 text-sm font-semibold capitalize w-fit">
              {roleLabels[profile?.role || ''] || profile?.role || 'Staff'}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-slate-600 dark:text-slate-400 font-medium">{tCommon('name')} *</Label>
            <Input id="full_name" {...register('full_name')} placeholder={tCommon('name')} className="border-slate-200 dark:border-slate-700" />
            {errors.full_name && <p className="text-sm text-red-500">{errors.full_name.message}</p>}
          </div>

          {/*
            Read-only, and it has to stay that way while the phone number *is*
            the login identity: sign-in converts it to a synthetic address
            (phoneToSyntheticEmail, src/lib/tenant-auth.ts) and matches that
            against auth.users.email. Writing a new number to profiles.phone
            alone — which is all this form could do from the browser — left the
            page showing one number while sign-in still demanded the old one,
            with no way for the user to work out why their login stopped
            working. Changing it goes through the admin routes, which update
            both sides together (see api/admin/tenants/[id]/route.ts).
          */}
          <div className="space-y-2">
            <Label className="text-slate-600 dark:text-slate-400 font-medium">{t('phone')}</Label>
            <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
              <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="tabular-nums">{formatPhoneInput(profile?.phone ?? '') || '—'}</span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t('phoneLockedHint')}</p>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="submit" disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-700 text-white transition-colors px-6 shadow-sm">
              {isSubmitting ? tCommon('loading') : tCommon('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
