import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { OrdersTable } from '@/components/sales/orders-table'
import { getOrdersPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canResource, getOwnerFilter } from '@/lib/permissions-server'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'sales' })
  return { title: t('orders') }
}

export default async function OrdersPage({
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
  const ownerId = await getOwnerFilter('sales', 'orders')
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canResource('sales', 'orders', 'edit')
  const canCreate = await canResource('sales', 'orders', 'create')
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, result] = await Promise.all([
    getTranslations('sales'),
    getTranslations('pageInfo'),
    getOrdersPage(tenantId, { page, pageSize, search, ownerId }),
  ])

  return (
    <div>
      <PageHeader
        title={t('orders')}
        subtitle={t('title')}
        info={tInfo('salesOrders')}
        action={canCreate ? { label: t('addSale'), href: `/${lang}/sales/orders/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'Falco', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('orders') },
        ]}
      />
      <OrdersTable
        orders={result.rows}
        lang={lang}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        totalPages={result.totalPages}
        canEdit={canEdit}
      />
    </div>
  )
}
