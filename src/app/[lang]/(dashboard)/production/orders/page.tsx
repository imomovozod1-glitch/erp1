import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ProductionOrdersTable } from '@/components/production/production-orders-table'
import { getProductionOrdersPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule, getDataScope, getPermissionContext } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'production' })
  return { title: t('orders') }
}

export default async function ProductionOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])

  const { page, pageSize, search } = readPageParams(sp)
  const [scope, permCtx] = await Promise.all([getDataScope('production'), getPermissionContext()])
  const ownerId = scope === 'own' ? permCtx?.userId : undefined
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status
  const status =
    statusParam === 'draft' || statusParam === 'completed' || statusParam === 'cancelled' ? statusParam : 'all'

  const canEdit = await canEditModule('production')
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tInfo, result] = await Promise.all([
    getTranslations('production'),
    getTranslations('pageInfo'),
    getProductionOrdersPage(tenantId, { page, pageSize, search, status, ownerId }),
  ])

  return (
    <div>
      <PageHeader
        title={t('orders')}
        subtitle={t('title')}
        info={tInfo('productionOrders')}
        action={canEdit ? { label: t('addOrder'), href: `/${lang}/production/orders/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('orders') },
        ]}
      />
      <ProductionOrdersTable
        orders={result.rows}
        lang={lang}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        totalPages={result.totalPages}
        status={status}
      />
    </div>
  )
}
