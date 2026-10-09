import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { TransactionCategoriesTable } from '@/components/finance/transaction-categories-table'
import { getTransactionCategoriesPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'finance' })
  return { title: t('txCategories') }
}

export default async function TransactionCategoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  const { page, pageSize, search } = readPageParams(sp)
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('finance')
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, categoriesPage] = await Promise.all([
    getTranslations('finance'),
    getTranslations('pageInfo'),
    getTransactionCategoriesPage(tenantId, { page, pageSize, search }),
  ])

  return (
    <div>
      <PageHeader
        title={t('txCategories')}
        subtitle={t('txCategoriesSubtitle')}
        info={tInfo('txCategories')}
        action={canEdit ? {
          label: t('addTxCategory'),
          href: `/${lang}/finance/categories/new`,
          icon: Plus,
        } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/finance/cashbox` },
          { label: t('txCategories') },
        ]}
      />
      <TransactionCategoriesTable
        categories={categoriesPage.rows}
        lang={lang}
        page={categoriesPage.page}
        pageSize={categoriesPage.pageSize}
        total={categoriesPage.total}
        totalPages={categoriesPage.totalPages}
      />
    </div>
  )
}
