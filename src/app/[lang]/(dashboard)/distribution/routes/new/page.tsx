import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { RouteForm } from '@/components/distribution/route-form'
import { Metadata } from 'next'
import { getCachedCustomersForSelect, getAssignableUsers } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'distribution' })
  return { title: t('addRoute') }
}

export default async function NewRoutePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  await requireModuleEdit('distribution', lang, '/distribution/routes')
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tCommon, customers, assignableUsers] = await Promise.all([
    getTranslations('distribution'),
    getTranslations('common'),
    getCachedCustomersForSelect(tenantId),
    getAssignableUsers(tenantId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addRoute')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/distribution` },
          { label: t('routes'), href: `/${lang}/distribution/routes` },
          { label: tCommon('add') },
        ]}
      />
      <RouteForm customers={customers} lang={lang} assignableUsers={assignableUsers} />
    </div>
  )
}
