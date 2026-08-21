'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-indigo-600" /> {t('title')}
        </CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">{t('fullName')}</Label>
              <Input id="full_name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" value={email} disabled className="bg-slate-50 dark:bg-slate-800/50" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500 gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
