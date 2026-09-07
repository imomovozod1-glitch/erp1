import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ProductsTable } from '@/components/inventory/products-table'
import { getProductsPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('products') }
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])

  // Paging, search and the status filter now live in the URL and are applied by
  // Postgres. This page previously fetched every product in the tenant and let
  // the browser slice ten rows out of it.
  const { page, pageSize, search } = readPageParams(sp)
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status
  const status = statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all'

  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('inventory')
  const tenantId = (await getCurrentTenantId()) as string
  const [t, result] = await Promise.all([
    getTranslations('inventory'),
    getProductsPage(tenantId, { page, pageSize, search, status }),
  ])

  return (
    <div>
      <PageHeader
        title={t('products')}
        subtitle={t('title')}
        action={canEdit ? {
          label: t('addProduct'),
          href: `/${lang}/inventory/products/new`,
          icon: Plus,
        } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('products') },
        ]}
      />
      <ProductsTable
        products={result.rows}
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
