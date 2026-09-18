import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { ProductionOrderForm } from '@/components/production/production-order-form'
import { Metadata } from 'next'
import {
  getCachedProductsForSelect,
  getAssignableUsers,
  getBomsForSelect,
  getNextProductionNumber,
} from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'production' })
  return { title: t('addOrder') }
}

export default async function NewProductionOrderPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  await requireModuleEdit('production', lang, '/production/orders')
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tCommon, products, boms, assignableUsers, nextOrderNumber] = await Promise.all([
    getTranslations('production'),
    getTranslations('common'),
    getCachedProductsForSelect(tenantId, { includeServices: true }),
    getBomsForSelect(tenantId),
    getAssignableUsers(tenantId),
    getNextProductionNumber(tenantId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addOrder')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/production` },
          { label: t('orders'), href: `/${lang}/production/orders` },
          { label: tCommon('add') },
        ]}
      />
      <ProductionOrderForm
        products={products}
        boms={boms}
        nextOrderNumber={nextOrderNumber}
        lang={lang}
        assignableUsers={assignableUsers}
      />
    </div>
  )
}
