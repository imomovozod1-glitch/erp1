import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { DeliveryForm } from '@/components/distribution/delivery-form'
import { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'
import {
  getAssignableUsers,
  getCachedRoutesForSelect,
  getDeliverableOrders,
  getCachedDeliveryDetails,
} from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'distribution' })
  return { title: t('editDelivery') }
}

export default async function EditDeliveryPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const tenantId = (await getCurrentTenantId()) as string
  await requireModuleEdit('distribution', lang, '/distribution/deliveries')

  const [t, tCommon, orders, routes, assignableUsers, delivery] = await Promise.all([
    getTranslations('distribution'),
    getTranslations('common'),
    getDeliverableOrders(tenantId),
    getCachedRoutesForSelect(tenantId),
    getAssignableUsers(tenantId),
    getCachedDeliveryDetails(id, tenantId),
  ])

  if (!delivery) {
    notFound()
  }
  // A delivered or cancelled parcel is a record of what happened; editing it
  // would rewrite history the sales order already followed.
  if (delivery.status === 'delivered' || delivery.status === 'cancelled') {
    redirect(`/${lang}/distribution/deliveries/${id}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('editDelivery')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/distribution` },
          { label: t('deliveries'), href: `/${lang}/distribution/deliveries` },
          { label: tCommon('edit') },
        ]}
      />
      <DeliveryForm
        initialData={delivery}
        orders={orders}
        routes={routes}
        assignableUsers={assignableUsers}
        nextNumber={delivery.delivery_number}
        lang={lang}
      />
    </div>
  )
}
