import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus, AlertTriangle, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { CustomersTable } from '@/components/sales/customers-table'
import { CustomerImportExport } from '@/components/sales/customer-import-export'
import { getCachedCustomers } from '@/lib/data/queries'
import { formatCurrency } from '@/lib/utils'

export const metadata: Metadata = { title: 'Customers' }

export default async function CustomersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, customers] = await Promise.all([
    getTranslations('sales'),
    getCachedCustomers(),
  ])

  const totalDebt = customers.reduce((sum, c: any) => sum + (Number(c.total_debt) || 0), 0)
  const totalCredit = customers.reduce((sum, c: any) => sum + (Number(c.credit_balance) || 0), 0)

  return (
    <div>
      <PageHeader
        title={t('customers')}
        action={{ label: t('addCustomer'), href: `/${lang}/customers/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('customers') },
        ]}
      >
        <CustomerImportExport customers={customers} lang={lang} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatsCard
          title={lang === 'uz' ? 'Umumiy qarzdorlik' : lang === 'ru' ? 'Общая задолженность' : 'Total debt'}
          value={formatCurrency(totalDebt)}
          subtitle={lang === 'uz' ? "Mijozlardan kutilayotgan to'lov" : lang === 'ru' ? 'Ожидаемая оплата от клиентов' : 'Expected from customers'}
          icon={AlertTriangle}
          iconClassName="bg-amber-500"
        />
        <StatsCard
          title={lang === 'uz' ? 'Umumiy haqdorlik' : lang === 'ru' ? 'Общий депозит клиентов' : 'Total customer credit'}
          value={formatCurrency(totalCredit)}
          subtitle={lang === 'uz' ? "Mijozlarning oldindan to'lagan puli" : lang === 'ru' ? 'Предоплата клиентов' : 'Customer prepayments'}
          icon={Wallet}
          iconClassName="bg-emerald-500"
        />
      </div>

      <CustomersTable customers={customers} lang={lang} />
    </div>
  )
}
