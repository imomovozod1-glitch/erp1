'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { isStrongPassword } from '@/lib/password-validation'

export function ResetPasswordForm({ tenantId }: { tenantId: string }) {
  const t = useTranslations('admin.resetPassword')
  const tPassword = useTranslations('admin.password')
  const tAuth = useTranslations('auth')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isStrongPassword(password)) {
      // The submit button used to be disabled here instead, so a password that
      // failed the policy produced no reaction at all — the form looked broken.
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
    <form onSubmit={handleSubmit} className="max-w-md space-y-1.5">
      <div className="flex items-end gap-3">
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
      </div>
      {password && !isStrongPassword(password) ? (
        <p className="text-xs text-red-500">{tAuth('passwordRequirements')}</p>
      ) : (
        <p className="text-xs text-slate-400 dark:text-slate-500">{tAuth('passwordRequirements')}</p>
      )}
    </form>
  )
}
