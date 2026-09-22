'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Globe, Loader2, ExternalLink } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'

interface DomainStatus {
  host: string
  configured: boolean
  registered: boolean
  wildcard: boolean
  verified: boolean
  serving: boolean
  missing: string[]
}

/**
 * The company's address, in the one state an operator can act on.
 *
 * Three questions, deliberately not collapsed into one (see
 * getTenantDomainStatus in src/lib/vercel-domains.ts): is the host known to
 * the platform, and does it actually answer? A host added a minute ago is
 * known and still unreachable while its certificate is issued, which is
 * exactly the window in which a newly created company looks broken — so that
 * window is named rather than reported as success.
 */
export function TenantDomainCard({ tenantId }: { tenantId: string }) {
  const t = useTranslations('admin.tenants.detail')
  const [status, setStatus] = useState<DomainStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/tenants/${tenantId}/domain`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DomainStatus | null) => {
        if (cancelled) return
        setStatus(data)
        setIsLoading(false)
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  const register = async () => {
    setIsRegistering(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/domain`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error || t('domainFailed'))
        return
      }
      setStatus(data)
      // Registered is not reachable yet: the certificate follows a minute or
      // two later, so the toast says to wait rather than declaring success.
      toast.success(data?.serving ? t('domainReady') : t('domainAddedPending'), { duration: 8000 })
    } catch {
      toast.error(t('domainFailed'))
    } finally {
      setIsRegistering(false)
    }
  }

  const state: { label: string; tone: StatusTone; hint?: string } = isLoading
    ? { label: t('domainChecking'), tone: 'slate' }
    : !status
      ? { label: t('domainFailed'), tone: 'slate' }
      : status.serving
        ? { label: t('domainServing'), tone: 'emerald', hint: status.wildcard ? t('domainWildcard') : undefined }
        : status.registered
          ? { label: t('domainPending'), tone: 'amber', hint: t('domainPendingHint') }
          : status.configured
            ? { label: t('domainMissing'), tone: 'rose', hint: t('domainMissingHint') }
            : { label: t('domainNotConfigured'), tone: 'slate', hint: status.missing.join(', ') }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {status?.host ?? '—'}
        </code>
        <StatusBadge label={state.label} tone={state.tone} />
      </div>

      {state.hint && <p className="text-sm text-muted-foreground">{state.hint}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {status && !status.registered && status.configured && (
          <Button type="button" variant="outline" size="sm" onClick={register} disabled={isRegistering}>
            {isRegistering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
            {t('domainRegister')}
          </Button>
        )}
        {status?.host && (
          // A plain anchor in button clothing: this Button has no `asChild`,
          // and the target is another origin — the company's own workspace.
          <a
            href={`https://${status.host}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('domainOpen')}
          </a>
        )}
      </div>
    </div>
  )
}
