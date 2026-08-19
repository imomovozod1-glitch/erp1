'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'

export function ResetPasswordForm({ tenantId }: { tenantId: string }) {
  const t = useTranslations('admin.resetPassword')
  const tPassword = useTranslations('admin.password')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error(t('tooShort'))
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('error'))
        return
      }
      toast.success(t('success'))
      setPassword('')
    } catch {
      toast.error(t('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 max-w-md">
      <div className="space-y-1.5 flex-1">
        <Label htmlFor="reset-password">{t('newPassword')}</Label>
        <PasswordInput
          id="reset-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          showLabel={tPassword('show')}
          hideLabel={tPassword('hide')}
        />
      </div>
      <Button type="submit" variant="outline" disabled={isSubmitting} className="gap-2">
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {t('submit')}
      </Button>
    </form>
  )
}
