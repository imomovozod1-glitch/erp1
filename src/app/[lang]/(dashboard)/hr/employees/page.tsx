import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { EmployeesTable } from '@/components/hr/employees-table'
import { EmployeeImportExport } from '@/components/hr/employee-import-export'
import { getCachedEmployees } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'Employees' }

export default async function EmployeesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, employees] = await Promise.all([
    getTranslations('hr'),
    getCachedEmployees(),
  ])

  return (
    <div>
      <PageHeader
        title={t('employees')}
        subtitle={t('title')}
        action={{ label: t('addEmployee'), href: `/${lang}/hr/employees/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('employees') },
        ]}
      >
        <EmployeeImportExport employees={employees} lang={lang} />
      </PageHeader>
      <EmployeesTable employees={employees} lang={lang} />
    </div>
  )
}
