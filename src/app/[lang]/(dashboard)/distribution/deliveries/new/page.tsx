import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { DeliveryForm } from '@/components/distribution/delivery-form'
import { Metadata } from 'next'
import {
  getAssignableUsers,
  getCachedRoutesForSelect,
  getDeliverableOrders,
  getNextDeliveryNumber,
} from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'distribution' })
  return { title: t('addDelivery') }
}

export default async function NewDeliveryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  await requireModuleEdit('distribution', lang, '/distribution/deliveries')
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tCommon, orders, routes, assignableUsers, nextNumber] = await Promise.all([
    getTranslations('distribution'),
    getTranslations('common'),
    getDeliverableOrders(tenantId),
    getCachedRoutesForSelect(tenantId),
    getAssignableUsers(tenantId),
    getNextDeliveryNumber(tenantId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addDelivery')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/distribution` },
          { label: t('deliveries'), href: `/${lang}/distribution/deliveries` },
          { label: tCommon('add') },
        ]}
      />
      <DeliveryForm
        orders={orders}
        routes={routes}
        assignableUsers={assignableUsers}
        nextNumber={nextNumber}
        lang={lang}
      />
    </div>
  )
}
