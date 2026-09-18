import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { ProductionOrderForm } from '@/components/production/production-order-form'
import { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'
import {
  getCachedProductsForSelect,
  getAssignableUsers,
  getBomsForSelect,
  getCachedProductionOrderDetails,
} from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'production' })
  return { title: t('editOrder') }
}

export default async function EditProductionOrderPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const tenantId = (await getCurrentTenantId()) as string
  await requireModuleEdit('production', lang, '/production/orders')

  const [t, tCommon, products, boms, assignableUsers, details] = await Promise.all([
    getTranslations('production'),
    getTranslations('common'),
    getCachedProductsForSelect(tenantId, { includeServices: true }),
    getBomsForSelect(tenantId),
    getAssignableUsers(tenantId),
    getCachedProductionOrderDetails(id, tenantId),
  ])

  if (!details.order) {
    notFound()
  }
  // A finished or cancelled run is a record of what happened — save_production_order
  // refuses it too, but sending the user to a form they cannot submit is worse
  // than showing them the run.
  if (details.order.status !== 'draft') {
    redirect(`/${lang}/production/orders/${id}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('editOrder')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/production` },
          { label: t('orders'), href: `/${lang}/production/orders` },
          { label: tCommon('edit') },
        ]}
      />
      <ProductionOrderForm
        initialData={details.order}
        initialItems={details.items}
        products={products}
        boms={boms}
        nextOrderNumber={details.order.order_number}
        lang={lang}
        assignableUsers={assignableUsers}
      />
    </div>
  )
}
