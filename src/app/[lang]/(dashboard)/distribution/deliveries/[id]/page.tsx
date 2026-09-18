import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { DeliveryDetail } from '@/components/distribution/delivery-detail'
import { getCachedDeliveryDetails } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'distribution' })
  return { title: t('delivery') }
}

export default async function DeliveryPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const tenantId = (await getCurrentTenantId()) as string
  const [t, canEdit, delivery] = await Promise.all([
    getTranslations('distribution'),
    canEditModule('distribution'),
    getCachedDeliveryDetails(id, tenantId),
  ])

  if (!delivery) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={delivery.delivery_number}
        subtitle={t('delivery')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/distribution` },
          { label: t('deliveries'), href: `/${lang}/distribution/deliveries` },
          { label: delivery.delivery_number },
        ]}
      />
      <DeliveryDetail delivery={delivery} lang={lang} canEdit={canEdit} />
    </div>
  )
}
