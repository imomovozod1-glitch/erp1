import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { getCachedEmployeeFormOptions } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { EmployeeForm } from '@/components/hr/employee-form'
import { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'hr' })
  return { title: t('addEmployee') }
}

export default async function NewEmployeePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('hr', lang, '/hr/employees')
  const tenantId = (await getCurrentTenantId()) as string
  // The form's dropdowns are read here, not from three effects after hydration.
  const [t, tCommon, options] = await Promise.all([
    getTranslations('hr'),
    getTranslations('common'),
    getCachedEmployeeFormOptions(tenantId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addEmployee')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/hr` },
          { label: t('employees'), href: `/${lang}/hr/employees` },
          { label: tCommon('add') },
        ]}
      />
      <EmployeeForm lang={lang} options={options} />
    </div>
  )
}
