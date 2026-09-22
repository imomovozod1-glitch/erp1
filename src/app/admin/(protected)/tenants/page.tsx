import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { PageHeader } from '@/components/shared/page-header'
import { TenantsTable, type TenantRow } from '@/components/admin/tenants-table'
import { DomainSyncButton } from '@/components/admin/domain-sync-button'
import { computeEffectiveStatus } from '@/lib/tenant-status'
import { WILDCARD_DOMAIN, listProjectDomains, tenantHost } from '@/lib/vercel-domains'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.tenants')
  return { title: t('title') }
}
export const dynamic = 'force-dynamic'

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const t = await getTranslations('admin.tenants')
  const initialStatus = status === 'active' || status === 'blocked' || status === 'inactive' ? status : 'all'

  const supabase = getCacheClient() as any
  // Both at once: the platform's domain list has nothing to do with the tenant
  // rows, and waiting for one before starting the other would put a second
  // network round trip in front of this page for no reason.
  const [{ data }, projectDomains] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, subdomain, company_name, phone, status, costing_method, subscription_ends_at, price_paid')
      .order('created_at', { ascending: false }),
    // `null` means the platform could not be asked at all (no credentials, or
    // its API failed) — which is not the same as "nothing is registered", so
    // nothing is flagged.
    listProjectDomains(),
  ])

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

  const unregisteredSubdomains =
    projectDomains && !projectDomains.has(WILDCARD_DOMAIN)
      ? tenants.map((tenant) => tenant.subdomain).filter((sub) => !projectDomains.has(tenantHost(sub)))
      : []

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('count', { count: tenants.length })}>
        <DomainSyncButton />
      </PageHeader>

      <TenantsTable
        tenants={tenants}
        initialStatus={initialStatus}
        unregisteredSubdomains={unregisteredSubdomains}
      />
    </div>
  )
}
