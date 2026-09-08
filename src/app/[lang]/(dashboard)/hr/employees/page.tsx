import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { EmployeesTable } from '@/components/hr/employees-table'
import { EmployeeImportExport } from '@/components/hr/employee-import-export'
import { getEmployeesPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule , canDo } from '@/lib/permissions-server'

export const metadata: Metadata = { title: 'Employees' }

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  // Paging, search and the employment filter live in the URL and are applied
  // by Postgres.
  const { page, pageSize, search } = readPageParams(sp)
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status
  const status = statusParam === 'hired' || statusParam === 'not_hired' ? statusParam : 'all'
  const paidParam = Array.isArray(sp.paid) ? sp.paid[0] : sp.paid
  const paid = paidParam === 'paid' || paidParam === 'free' ? paidParam : 'all'
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('hr')
  // Reading a list on screen and downloading the whole list are different
  // risks, so export is its own permission.
  const canExport = await canDo('hr', 'export')
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, result] = await Promise.all([
    getTranslations('hr'),
    getTranslations('pageInfo'),
    getEmployeesPage(tenantId, { page, pageSize, search, status, paid }),
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
        {canExport && <EmployeeImportExport employees={result.rows} lang={lang} />}
      </PageHeader>
      <EmployeesTable
        employees={result.rows}
        lang={lang}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        totalPages={result.totalPages}
        status={status}
        paid={paid}
      />
    </div>
  )
}
