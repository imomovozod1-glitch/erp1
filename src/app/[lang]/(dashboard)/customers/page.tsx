import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus, Scale } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { CustomersTable } from '@/components/sales/customers-table'
import { CustomerImportExport } from '@/components/sales/customer-import-export'
import { getCachedCustomers } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { formatCurrency } from '@/lib/utils'

export const metadata: Metadata = { title: 'Customers' }

export default async function CustomersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const [t, tNav, customers] = await Promise.all([
    getTranslations('sales'),
    getTranslations('nav'),
    getCachedCustomers(tenantId),
  ])

  const totalDebt = customers.reduce((sum, c: any) => sum + (Number(c.total_debt) || 0), 0)
  const totalCredit = customers.reduce((sum, c: any) => sum + (Number(c.credit_balance) || 0), 0)
  // Net balance across all customers: credit (haqdorlik) minus debt (qarz) — positive
  // means customers collectively hold credit with us, negative means they owe us.
  const totalBalance = totalCredit - totalDebt

  return (
    <div>
      <PageHeader
        title={t('customers')}
        action={{ label: t('addCustomer'), href: `/${lang}/customers/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: tNav('customers'), href: `/${lang}/customers` },
          { label: t('customers') },
        ]}
      >
        <CustomerImportExport customers={customers} lang={lang} />
      </PageHeader>

      <div className="grid grid-cols-1 mb-6">
        <StatsCard
          title={lang === 'uz' ? 'Balans qoldig\'i' : lang === 'ru' ? 'Остаток баланса' : 'Balance'}
          value={`${totalBalance > 0 ? '+' : totalBalance < 0 ? '-' : ''}${formatCurrency(Math.abs(totalBalance))}`}
          valueClassName={totalBalance > 0 ? 'text-emerald-600' : totalBalance < 0 ? 'text-rose-600' : undefined}
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

      <CustomersTable customers={customers} lang={lang} />
    </div>
  )
}
