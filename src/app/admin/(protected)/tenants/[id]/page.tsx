import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { KeyRound, ShieldAlert, Receipt } from 'lucide-react'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { TenantForm } from '@/components/admin/tenant-form'
import { DeleteTenantButton } from '@/components/admin/delete-tenant-button'
import { ResetPasswordForm } from '@/components/admin/reset-password-form'
import { PaymentHistory } from '@/components/admin/payment-history'
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
  const [{ data: tenant }, { data: payments }] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('tenant_payments')
      .select('id, amount, paid_at, created_at, note')
      .eq('tenant_id', id)
      .order('paid_at', { ascending: false }),
  ])

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
      <PageHeader
        title={tenant.company_name}
        subtitle={`${tenant.subdomain} · ${formatPhoneInput(tenant.phone)}`}
        breadcrumbs={[
          { label: tStatus('title'), href: '/admin/tenants' },
          { label: tenant.company_name },
        ]}
      />

      <div className="flex items-center gap-3 -mt-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
          {getInitials(tenant.company_name)}
        </div>
        <StatusBadge label={statusLabel} tone={STATUS_TONE[tenant.status] ?? 'slate'} />
      </div>

      <TenantForm
        mode="edit"
        initialData={{
          id: tenant.id,
          subdomain: tenant.subdomain,
          company_name: tenant.company_name,
          phone: tenant.phone,
          costing_method: tenant.costing_method,
          license_count: tenant.license_count,
          license_months: tenant.license_months,
          subscription_started_at: tenant.subscription_started_at,
          subscription_ends_at: tenant.subscription_ends_at,
          details: tenant.details,
        }}
      />

      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-indigo-600" /> {t('paymentHistory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentHistory tenantId={tenant.id} payments={payments ?? []} totalPaid={tenant.price_paid ?? 0} />
        </CardContent>
      </Card>

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
