'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AdminField,
  AdminFormActions,
  AdminFormSection,
  AdminFormShell,
} from '@/components/admin/admin-form-layout'

export function AdminProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const t = useTranslations('admin.settings.profile')
  const router = useRouter()
  const [name, setName] = useState(fullName)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || t('error'))
        return
      }
      toast.success(t('success'))
      router.refresh()
    } catch {
      toast.error(t('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminFormShell>
      <form onSubmit={handleSubmit}>
        <AdminFormSection icon={User} title={t('title')} description={t('subtitle')}>
          <AdminField>
            <Label htmlFor="full_name">{t('fullName')}</Label>
            <Input id="full_name" value={name} onChange={(e) => setName(e.target.value)} />
          </AdminField>
          <AdminField>
            <Label htmlFor="email">{t('email')}</Label>
            <Input id="email" value={email} disabled className="bg-slate-50 dark:bg-slate-800/50" />
          </AdminField>
        </AdminFormSection>

        <AdminFormActions>
          <Button type="submit" disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-500 gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </AdminFormActions>
      </form>
    </AdminFormShell>
  )
}
