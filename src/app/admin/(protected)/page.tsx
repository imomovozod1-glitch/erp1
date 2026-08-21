import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Building2, CheckCircle2, Ban, Wallet, Plus, ArrowRight } from 'lucide-react'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminRevenueChart } from '@/components/admin/admin-revenue-chart'
import { computeEffectiveStatus } from '@/lib/tenant-status'
import { formatCurrency, getInitials } from '@/lib/utils'

export const metadata: Metadata = { title: 'Admin dashboard' }
export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'emerald',
  blocked: 'rose',
  inactive: 'slate',
}

export default async function AdminDashboardPage() {
  const [t, tTenants, lang] = await Promise.all([
    getTranslations('admin.dashboard'),
    getTranslations('admin.tenants'),
    getLocale(),
  ])

  const supabase = getCacheClient() as any
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)

  const [{ data: tenantRows }, { data: paymentRows }] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, subdomain, company_name, status, subscription_ends_at, price_paid, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('tenant_payments')
      .select('amount, paid_at')
      .gte('paid_at', sixMonthsAgo.toISOString()),
  ])

  const tenants = (tenantRows ?? []).map((tenant: any) => ({
    ...tenant,
    status: computeEffectiveStatus(tenant.status, tenant.subscription_ends_at),
  }))

  const active = tenants.filter((tenant: any) => tenant.status === 'active').length
  const blocked = tenants.filter((tenant: any) => tenant.status === 'blocked').length
  const revenue = tenants.reduce((sum: number, tenant: any) => sum + (tenant.price_paid ?? 0), 0)

  const localeTag = lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US'
  const monthBuckets: { key: string; monthLabel: string; revenue: number }[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo)
    d.setMonth(d.getMonth() + i)
    monthBuckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      monthLabel: d.toLocaleDateString(localeTag, { month: 'short' }),
      revenue: 0,
    })
  }
  for (const payment of paymentRows ?? []) {
    const d = new Date(payment.paid_at)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const bucket = monthBuckets.find((b) => b.key === key)
    if (bucket) bucket.revenue += Number(payment.amount) || 0
  }

  const recentTenants = tenants.slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={{ label: t('newTenant'), href: '/admin/tenants/new', icon: Plus }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={tTenants('statTotal')} value={tenants.length} icon={Building2} iconClassName="bg-indigo-500" />
        <StatsCard title={tTenants('statActive')} value={active} icon={CheckCircle2} iconClassName="bg-emerald-500" />
        <StatsCard title={tTenants('statBlocked')} value={blocked} icon={Ban} iconClassName="bg-rose-500" />
        <StatsCard title={tTenants('statRevenue')} value={formatCurrency(revenue)} icon={Wallet} iconClassName="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {t('revenueOverTime')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminRevenueChart
              data={monthBuckets.map(({ monthLabel, revenue }) => ({ monthLabel, revenue }))}
              emptyLabel={t('noPayments')}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {t('recentTenants')}
            </CardTitle>
            <Link
              href="/admin/tenants"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
            >
              {t('viewAll')} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentTenants.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">{tTenants('empty')}</p>
            ) : (
              recentTenants.map((tenant: any) => (
                <Link
                  key={tenant.id}
                  href={`/admin/tenants/${tenant.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                    {getInitials(tenant.company_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {tenant.company_name}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{tenant.subdomain}</p>
                  </div>
                  <StatusBadge
                    label={tTenants(`status${tenant.status.charAt(0).toUpperCase()}${tenant.status.slice(1)}`)}
                    tone={STATUS_TONE[tenant.status] ?? 'slate'}
                  />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {blocked > 0 && (
        <Card className="border-0 shadow-sm border-rose-100 dark:border-rose-900/30 bg-rose-50/40 dark:bg-rose-950/10">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                <Ban className="h-4 w-4" />
              </div>
              <p className="text-sm text-rose-700 dark:text-rose-400">{t('blockedWarning', { count: blocked })}</p>
            </div>
            <Link
              href="/admin/tenants?status=blocked"
              className="inline-flex items-center h-7 px-2.5 text-[0.8rem] font-medium rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors"
            >
              {t('viewAll')}
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
