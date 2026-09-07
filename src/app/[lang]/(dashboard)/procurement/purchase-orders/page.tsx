import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { PurchaseOrdersTable } from '@/components/procurement/purchase-orders-table'
import { getPurchaseOrdersPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule, getDataScope, getPermissionContext } from '@/lib/permissions-server'

export const revalidate = 30

export const metadata: Metadata = { title: 'Purchase Orders' }

export default async function PurchaseOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  // Paging and search live in the URL and are applied by Postgres; this page
  // used to fetch every row in the tenant and slice ten out in the browser.
  const { page, pageSize, search } = readPageParams(sp)
  // A user whose data scope for this module is 'own' only ever sees the
  // records they created — applied in the query, not by hiding rows after the
  // fact.
  const [scope, permCtx] = await Promise.all([getDataScope('procurement'), getPermissionContext()])
  const ownerId = scope === 'own' ? permCtx?.userId : undefined
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('procurement')
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, result] = await Promise.all([
    getTranslations('procurement'),
    getTranslations('pageInfo'),
    getPurchaseOrdersPage(tenantId, { page, pageSize, search, ownerId }),
  ])

  return (
    <div>
      <PageHeader
        title={t('purchases')}
        subtitle={t('title')}
        info={tInfo('purchaseOrders')}
        action={canEdit ? { label: t('addPurchase'), href: `/${lang}/procurement/purchase-orders/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('purchases') },
        ]}
      />
      <PurchaseOrdersTable
        orders={result.rows}
        lang={lang}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        totalPages={result.totalPages}
      />
    </div>
  )
}
