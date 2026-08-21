import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Building2, CheckCircle2, Ban, Wallet } from 'lucide-react'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { PageHeader } from '@/components/shared/page-header'
import { PageClock } from '@/components/shared/page-clock'
import { StatsCard } from '@/components/shared/stats-card'
import { TenantsTable, type TenantRow } from '@/components/admin/tenants-table'
import { formatCurrency } from '@/lib/utils'
import { computeEffectiveStatus } from '@/lib/tenant-status'

export const metadata: Metadata = { title: 'Tenants' }
export const dynamic = 'force-dynamic'

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const [t, lang] = await Promise.all([getTranslations('admin.tenants'), getLocale()])
  const initialStatus = status === 'active' || status === 'blocked' || status === 'inactive' ? status : 'all'

  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('tenants')
    .select('id, subdomain, company_name, phone, status, costing_method, subscription_ends_at, price_paid')
    .order('created_at', { ascending: false })

  const rawTenants: TenantRow[] = data ?? []

  // Lazy subscription enforcement (see src/lib/tenant-status.ts): a tenant
  // still marked "active" past its subscription_ends_at with no renewal is
  // shown — and persisted — as blocked here too, so the list never lags
  // behind what src/proxy.ts already enforces at the actual gate.
  const tenants: TenantRow[] = rawTenants.map((tenant) => {
    const effectiveStatus = computeEffectiveStatus(tenant.status, tenant.subscription_ends_at) as TenantRow['status']
    if (effectiveStatus !== tenant.status) {
      supabase.from('tenants').update({ status: effectiveStatus }).eq('id', tenant.id).then(() => {})
      return { ...tenant, status: effectiveStatus }
    }
    return tenant
  })

  const active = tenants.filter((tenant) => tenant.status === 'active').length
  const blocked = tenants.filter((tenant) => tenant.status === 'blocked').length
  const revenue = tenants.reduce((sum, tenant) => sum + (tenant.price_paid ?? 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('count', { count: tenants.length })}>
        <PageClock lang={lang} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t('statTotal')} value={tenants.length} icon={Building2} iconClassName="bg-indigo-500" />
        <StatsCard title={t('statActive')} value={active} icon={CheckCircle2} iconClassName="bg-emerald-500" />
        <StatsCard title={t('statBlocked')} value={blocked} icon={Ban} iconClassName="bg-rose-500" />
        <StatsCard title={t('statRevenue')} value={formatCurrency(revenue)} icon={Wallet} iconClassName="bg-amber-500" />
      </div>

      <TenantsTable tenants={tenants} initialStatus={initialStatus} />
    </div>
  )
}
