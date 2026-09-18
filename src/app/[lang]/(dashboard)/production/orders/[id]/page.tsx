import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { ProductionOrderDetail } from '@/components/production/production-order-detail'
import { getCachedProductionOrderDetails } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'production' })
  return { title: t('order') }
}

export default async function ProductionOrderPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const tenantId = (await getCurrentTenantId()) as string
  const [t, canEdit, details] = await Promise.all([
    getTranslations('production'),
    canEditModule('production'),
    getCachedProductionOrderDetails(id, tenantId),
  ])

  if (!details.order) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={details.order.order_number}
        subtitle={t('order')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/production` },
          { label: t('orders'), href: `/${lang}/production/orders` },
          { label: details.order.order_number },
        ]}
      />
      <ProductionOrderDetail order={details.order} items={details.items} lang={lang} canEdit={canEdit} />
    </div>
  )
}
