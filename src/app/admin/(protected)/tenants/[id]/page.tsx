import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ArrowLeft, KeyRound, ShieldAlert } from 'lucide-react'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { TenantForm } from '@/components/admin/tenant-form'
import { DeleteTenantButton } from '@/components/admin/delete-tenant-button'
import { ResetPasswordForm } from '@/components/admin/reset-password-form'
import { computeEffectiveStatus } from '@/lib/tenant-status'
import { formatPhoneInput } from '@/lib/tenant-auth'
import { getInitials } from '@/lib/utils'

export const metadata: Metadata = { title: 'Edit tenant' }
export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'emerald',
  blocked: 'rose',
  inactive: 'slate',
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [t, tStatus] = await Promise.all([
    getTranslations('admin.tenants.detail'),
    getTranslations('admin.tenants'),
  ])

  const supabase = getCacheClient() as any
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!tenant) notFound()

  // Lazy subscription enforcement (see src/lib/tenant-status.ts) — mirrors
  // what src/proxy.ts already enforces at the actual access gate, so the
  // admin panel never shows a stale "active" for a lapsed, unpaid tenant.
  const effectiveStatus = computeEffectiveStatus(tenant.status, tenant.subscription_ends_at)
  if (effectiveStatus !== tenant.status) {
    await supabase.from('tenants').update({ status: effectiveStatus }).eq('id', tenant.id)
    tenant.status = effectiveStatus
  }

  const statusLabel = tenant.status === 'blocked' ? tStatus('statusBlocked') : tStatus('statusActive')

  return (
    <div className="space-y-8">
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>

      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-bold text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
          {getInitials(tenant.company_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {tenant.company_name}
            </h1>
            <StatusBadge label={statusLabel} tone={STATUS_TONE[tenant.status] ?? 'slate'} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {tenant.subdomain} · {formatPhoneInput(tenant.phone)}
          </p>
        </div>
      </div>

      <TenantForm
        mode="edit"
        initialData={{
          id: tenant.id,
          subdomain: tenant.subdomain,
          company_name: tenant.company_name,
          phone: tenant.phone,
          status: tenant.status,
          costing_method: tenant.costing_method,
          subscription_started_at: tenant.subscription_started_at,
          subscription_ends_at: tenant.subscription_ends_at,
          price_paid: tenant.price_paid,
          details: tenant.details,
        }}
      />

      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-indigo-600" /> {t('ownerLogin')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm tenantId={tenant.id} />
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 max-w-3xl border-rose-100 dark:border-rose-900/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-rose-600 dark:text-rose-400">
            <ShieldAlert className="h-4 w-4" /> {t('dangerZone')}
          </CardTitle>
          <CardDescription>{t('dangerZoneDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteTenantButton
            tenantId={tenant.id}
            companyName={tenant.company_name}
            status={tenant.status}
            lastActiveAt={tenant.last_active_at}
            createdAt={tenant.created_at}
            subscriptionEndsAt={tenant.subscription_ends_at}
          />
        </CardContent>
      </Card>
    </div>
  )
}
