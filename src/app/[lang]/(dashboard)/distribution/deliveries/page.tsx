import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { DeliveriesTable } from '@/components/distribution/deliveries-table'
import { DeliveryStats, DeliveryAgentBreakdown } from '@/components/distribution/delivery-stats'
import { getDeliveriesPage, getCachedDeliveryStats } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule, getDataScope, getPermissionContext } from '@/lib/permissions-server'
import { DELIVERY_STATUSES, type DeliveryStatus } from '@/lib/statuses'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'distribution' })
  return { title: t('deliveries') }
}

export default async function DeliveriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])

  const { page, pageSize, search } = readPageParams(sp)
  const [scope, permCtx] = await Promise.all([getDataScope('distribution'), getPermissionContext()])
  const ownerId = scope === 'own' ? permCtx?.userId : undefined
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status
  const status: 'all' | DeliveryStatus = DELIVERY_STATUSES.includes(statusParam as DeliveryStatus)
    ? (statusParam as DeliveryStatus)
    : 'all'

  const canEdit = await canEditModule('distribution')
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tInfo, result, stats] = await Promise.all([
    getTranslations('distribution'),
    getTranslations('pageInfo'),
    getDeliveriesPage(tenantId, { page, pageSize, search, status, ownerId }),
    getCachedDeliveryStats(tenantId),
  ])

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('deliveries')}
        subtitle={t('title')}
        info={tInfo('deliveries')}
        action={
          canEdit ? { label: t('addDelivery'), href: `/${lang}/distribution/deliveries/new`, icon: Plus } : undefined
        }
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('deliveries') },
        ]}
      />
      <DeliveryStats stats={stats} />
      <DeliveriesTable
        deliveries={result.rows}
        lang={lang}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        totalPages={result.totalPages}
        status={status}
        canEdit={canEdit}
      />
      <DeliveryAgentBreakdown stats={stats} />
    </div>
  )
}
