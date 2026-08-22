import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Wallet, TrendingUp, Receipt, Building2 } from 'lucide-react'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { AdminPaymentsTable, type AdminPaymentRow } from '@/components/admin/admin-payments-table'
import { formatCurrency } from '@/lib/utils'

export const metadata: Metadata = { title: 'Payments' }
export const dynamic = 'force-dynamic'

export default async function AdminPaymentsPage() {
  const t = await getTranslations('admin.payments')

  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('tenant_payments')
    .select('id, amount, paid_at, created_at, note, tenant_id, tenants(company_name, subdomain)')
    .order('paid_at', { ascending: false })

  const payments: AdminPaymentRow[] = (data ?? []).map((row: any) => ({
    id: row.id,
    amount: Number(row.amount) || 0,
    paid_at: row.paid_at,
    created_at: row.created_at,
    note: row.note,
    tenant_id: row.tenant_id,
    tenant_company_name: row.tenants?.company_name ?? '—',
    tenant_subdomain: row.tenants?.subdomain ?? '—',
  }))

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)
  const now = new Date()
  const monthRevenue = payments
    .filter((p) => {
      const d = new Date(p.paid_at)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((sum, p) => sum + p.amount, 0)
  const uniqueTenants = new Set(payments.map((p) => p.tenant_id)).size

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t('statTotal')} value={formatCurrency(totalRevenue)} icon={Wallet} iconClassName="bg-emerald-500" />
        <StatsCard title={t('statThisMonth')} value={formatCurrency(monthRevenue)} icon={TrendingUp} iconClassName="bg-indigo-500" />
        <StatsCard title={t('statCount')} value={payments.length} icon={Receipt} iconClassName="bg-amber-500" />
        <StatsCard title={t('statTenants')} value={uniqueTenants} icon={Building2} iconClassName="bg-blue-500" />
      </div>

      <AdminPaymentsTable payments={payments} />
    </div>
  )
}
