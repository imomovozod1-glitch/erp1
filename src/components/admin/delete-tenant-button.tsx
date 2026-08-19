'use client'

import { useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000 // 180 days
const DAY_MS = 24 * 60 * 60 * 1000

// `Date.now()` is impure and can't be called during render (React Compiler
// purity rule — see src/components/shared/page-clock.tsx for the established
// pattern). No interval needed here — a single client-only snapshot at mount
// is enough for a 180-day threshold.
function subscribe() {
  return () => {}
}
function getSnapshot() {
  return Date.now()
}
function getServerSnapshot() {
  return 0
}

export function DeleteTenantButton({
  tenantId,
  companyName,
  status,
  lastActiveAt,
  createdAt,
  subscriptionEndsAt,
}: {
  tenantId: string
  companyName: string
  status: string
  lastActiveAt: string | null
  createdAt: string
  subscriptionEndsAt: string | null
}) {
  const t = useTranslations('admin.delete')
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (now === 0) {
    return (
      <Button type="button" variant="outline" disabled className="gap-2 opacity-50">
        <Trash2 className="h-4 w-4" /> {t('button')}
      </Button>
    )
  }

  // Two independent paths to eligibility: 180 days since the account was
  // last actually used, OR — if it's blocked — 180 days since it became
  // blocked (subscription_ends_at, the date non-payment took effect; see
  // src/lib/tenant-status.ts for the auto active→blocked transition).
  const inactivityElapsed = now - new Date(lastActiveAt ?? createdAt).getTime()
  const blockedElapsed =
    status === 'blocked' && subscriptionEndsAt ? now - new Date(subscriptionEndsAt).getTime() : null

  const eligible = inactivityElapsed > THRESHOLD_MS || (blockedElapsed != null && blockedElapsed > THRESHOLD_MS)

  const remainingCandidates = [Math.ceil((THRESHOLD_MS - inactivityElapsed) / DAY_MS)]
  if (blockedElapsed != null) remainingCandidates.push(Math.ceil((THRESHOLD_MS - blockedElapsed) / DAY_MS))
  const daysRemaining = Math.max(0, Math.min(...remainingCandidates))

  const handleDelete = async () => {
    if (!eligible) return
    if (!confirm(t('confirm', { name: companyName }))) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || t('error'))
        setIsDeleting(false)
        return
      }
      toast.success(t('success'))
      router.push('/admin/tenants')
      router.refresh()
    } catch {
      toast.error(t('error'))
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        disabled={!eligible || isDeleting}
        onClick={handleDelete}
        className="gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-400"
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        {t('button')}
      </Button>
      {!eligible && <p className="text-xs text-slate-400">{t('enabledAfter', { days: daysRemaining })}</p>}
    </div>
  )
}
