import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { EmployeeForm } from '@/components/hr/employee-form'
import { Metadata } from 'next'
import { getCachedEmployeeById } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { notFound } from 'next/navigation'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const tCommon = await getTranslations({ locale: lang, namespace: 'common' })
  return { title: tCommon('edit') }
}

/**
 * Only the *fetch* is wrapped in try/catch — getCachedEmployeeById throws on a
 * missing row (PostgREST .single()), which should render a 404. The JSX below
 * must stay outside it: React doesn't render the tree synchronously, so a
 * render-time error would never be caught here anyway, and swallowing it into
 * notFound() would turn a real bug into a silent "not found"
 * (react-hooks/error-boundaries).
 */
export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ lang: string, id: string }>
}) {
  const { lang, id } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('hr', lang, '/hr/employees')
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return notFound()

  let employee: Awaited<ReturnType<typeof getCachedEmployeeById>> = null
  try {
    employee = await getCachedEmployeeById(id, tenantId)
  } catch {
    employee = null
  }
  if (!employee) return notFound()

  const [t, tCommon] = await Promise.all([
    getTranslations('hr'),
    getTranslations('common'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={tCommon('edit')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/hr` },
          { label: t('employees'), href: `/${lang}/hr/employees` },
          { label: tCommon('edit') },
        ]}
      />
      <div className="px-4 md:px-8">
        <EmployeeForm lang={lang} initialData={employee} />
      </div>
    </div>
  )
}
