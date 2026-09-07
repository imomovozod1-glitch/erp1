import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { EmployeesTable } from '@/components/hr/employees-table'
import { EmployeeImportExport } from '@/components/hr/employee-import-export'
import { getCachedEmployees } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export const metadata: Metadata = { title: 'Employees' }

export default async function EmployeesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('hr')
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, employees] = await Promise.all([
    getTranslations('hr'),
    getTranslations('pageInfo'),
    getCachedEmployees(tenantId),
  ])

  return (
    <div>
      <PageHeader
        title={t('employees')}
        subtitle={t('title')}
        info={tInfo('employees')}
        action={canEdit ? { label: t('addEmployee'), href: `/${lang}/hr/employees/new`, icon: Plus } : undefined}
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
