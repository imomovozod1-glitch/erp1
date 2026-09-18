import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { RouteForm } from '@/components/distribution/route-form'
import { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'
import { getCachedCustomersForSelect, getAssignableUsers, getCachedRouteDetails } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'distribution' })
  return { title: t('editRoute') }
}

export default async function EditRoutePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const tenantId = (await getCurrentTenantId()) as string
  await requireModuleEdit('distribution', lang, '/distribution/routes')

  const [t, tCommon, customers, assignableUsers, details] = await Promise.all([
    getTranslations('distribution'),
    getTranslations('common'),
    getCachedCustomersForSelect(tenantId),
    getAssignableUsers(tenantId),
    getCachedRouteDetails(id, tenantId),
  ])

  if (!details.route) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('editRoute')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/distribution` },
          { label: t('routes'), href: `/${lang}/distribution/routes` },
          { label: tCommon('edit') },
        ]}
      />
      <RouteForm
        initialData={details.route}
        initialStops={details.stops}
        customers={customers}
        lang={lang}
        assignableUsers={assignableUsers}
      />
    </div>
  )
}
