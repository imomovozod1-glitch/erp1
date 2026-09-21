'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Globe, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Registers any tenant host the hosting platform is not serving yet.
 *
 * Provisioning already does this for a new company (src/lib/vercel-domains.ts).
 * This is for the rest: companies created before the mechanism existed, and
 * the ones whose registration failed because the platform API was briefly
 * unreachable. Safe to press at any time — hosts already registered are
 * skipped, not re-added.
 */
export function DomainSyncButton() {
  const t = useTranslations('admin.tenants')
  const [isSyncing, setIsSyncing] = useState(false)

  const sync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/admin/domains', { method: 'POST' })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(data?.error || t('domainsFailed'))
      } else if (data?.configured === false) {
        toast.error(t('domainsNotConfigured'), { duration: 8000 })
      } else if (data?.failed?.length) {
        toast.error(
          `${t('domainsPartial', { added: data.added, failed: data.failed.length })}: ${data.failed
            .map((f: { host: string; error: string }) => `${f.host} — ${f.error}`)
            .join('; ')}`,
          { duration: 10000 }
        )
      } else if (data?.added > 0) {
        toast.success(t('domainsAdded', { count: data.added }))
      } else {
        toast.success(t('domainsUpToDate', { count: data?.checked ?? 0 }))
      }
    } catch {
      toast.error(t('domainsFailed'))
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={sync} disabled={isSyncing}>
      {isSyncing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Globe className="h-4 w-4 mr-2" />
      )}
      {t('syncDomains')}
    </Button>
  )
}
