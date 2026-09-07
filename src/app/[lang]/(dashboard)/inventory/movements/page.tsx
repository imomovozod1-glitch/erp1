import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { MovementsTable } from '@/components/inventory/movements-table'
import { getMovementsPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('stockMovements') }
}

export default async function MovementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  // Paging and search live in the URL and are applied by Postgres.
  const { page, pageSize, search } = readPageParams(sp)
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, result] = await Promise.all([
    getTranslations('inventory'),
    getTranslations('pageInfo'),
    getMovementsPage(tenantId, { page, pageSize, search }),
  ])

  return (
    <div>
      <PageHeader
        title={t('stockMovements')}
        info={tInfo('movements')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/inventory` },
          { label: t('stockMovements') },
        ]}
      />
      <MovementsTable
        movements={result.rows}
        lang={lang}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        totalPages={result.totalPages}
      />
    </div>
  )
}
