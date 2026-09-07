import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus, Scale } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { CustomersViewTabs } from '@/components/sales/customers-view-tabs'
import { CustomerImportExport } from '@/components/sales/customer-import-export'
import { getCustomersPage , getCustomersMapPoints, getCustomerBalanceTotals} from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { formatCurrency } from '@/lib/utils'
import { canEditModule , canDo, getDataScope, getPermissionContext } from '@/lib/permissions-server'

export const metadata: Metadata = { title: 'Customers' }

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  const { page, pageSize, search } = readPageParams(sp)
  // With the `own` data scope this list is limited to the records this user
  // is responsible for (plus unassigned ones) — applied in the query.
  const [scope, permCtx] = await Promise.all([getDataScope('customers'), getPermissionContext()])
  const ownerId = scope === 'own' ? permCtx?.userId : undefined
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('customers')
  // Reading a list on screen and downloading the whole list are different
  // risks, so export is its own permission.
  const canExport = await canDo('customers', 'export')
  const tenantId = await getCurrentTenantId() as string
  const [t, tNav, tInfo, result, mapPoints, totals] = await Promise.all([
    getTranslations('sales'),
    getTranslations('nav'),
    getTranslations('pageInfo'),
    getCustomersPage(tenantId, { page, pageSize, search, ownerId }),
    // The map plots every customer with coordinates; only the LIST is paged.
    getCustomersMapPoints(tenantId),
    getCustomerBalanceTotals(tenantId),
  ])

  const { totalDebt, totalCredit } = totals
  // Net balance across all customers: credit (haqdorlik) minus debt (qarz) — positive
  // means customers collectively hold credit with us, negative means they owe us.
  const totalBalance = totalCredit - totalDebt

  return (
    <div>
      <PageHeader
        title={t('customers')}
        info={tInfo('customers')}
        action={canEdit ? { label: t('addCustomer'), href: `/${lang}/customers/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: tNav('customers'), href: `/${lang}/customers` },
          { label: t('customers') },
        ]}
      >
        {canExport && <CustomerImportExport customers={result.rows} lang={lang} />}
      </PageHeader>

      <div className="grid grid-cols-1 mb-6">
        <StatsCard
          title={lang === 'uz' ? 'Balans qoldig\'i' : lang === 'ru' ? 'Остаток баланса' : 'Balance'}
          value={`${totalBalance > 0 ? '+' : totalBalance < 0 ? '-' : ''}${formatCurrency(Math.abs(totalBalance))}`}
          valueClassName={totalBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : totalBalance < 0 ? 'text-rose-600 dark:text-rose-400' : undefined}
          subtitle={
            lang === 'uz'
              ? `Qarz: ${formatCurrency(totalDebt)} · Haqdorlik: ${formatCurrency(totalCredit)}`
              : lang === 'ru'
              ? `Долг: ${formatCurrency(totalDebt)} · Депозит: ${formatCurrency(totalCredit)}`
              : `Debt: ${formatCurrency(totalDebt)} · Credit: ${formatCurrency(totalCredit)}`
          }
          icon={Scale}
          iconClassName={totalBalance > 0 ? 'bg-emerald-500' : totalBalance < 0 ? 'bg-rose-500' : 'bg-slate-400'}
        />
      </div>

      <CustomersViewTabs
        customers={result.rows}
        mapCustomers={mapPoints}
        lang={lang}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        totalPages={result.totalPages}
      />
    </div>
  )
}
