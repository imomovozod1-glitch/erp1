import { getCachedEmployeeDetails } from '@/lib/data/queries'
import { EmployeeDetailClient } from '@/components/hr/employee-detail-client'
import { PageHeader } from '@/components/shared/page-header'
import { PageClock } from '@/components/shared/page-clock'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

interface EmployeeDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
  const { id, lang } = await params
  const t = await getTranslations('hr')
  const details = await getCachedEmployeeDetails(id)

  if (!details || !details.employee) {
    notFound()
  }

  const { employee, transactions, salesOrders } = details

  return (
    <div className="flex flex-col gap-4 p-4 md:p-8 pt-6">
      <PageHeader
        title={employee?.profiles?.full_name ?? '—'}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('employees', { fallback: 'Xodimlar' }), href: `/${lang}/hr/employees` },
          { label: employee?.profiles?.full_name ?? '—' }
        ]}
      >
        <PageClock lang={lang} />
      </PageHeader>

      <EmployeeDetailClient
        lang={lang}
        employee={employee}
        transactions={transactions}
        salesOrders={salesOrders}
      />
    </div>
  )
}
