import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { InvoicesTable } from '@/components/sales/invoices-table'
import { getInvoicesPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export const revalidate = 30

export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage({
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
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('sales')
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, result] = await Promise.all([
    getTranslations('sales'),
    getTranslations('pageInfo'),
    getInvoicesPage(tenantId, { page, pageSize, search }),
  ])

  return (
    <div>
      <PageHeader
        title={t('invoices')}
        subtitle={t('title')}
        info={tInfo('invoices')}
        action={canEdit ? { label: t('addInvoice'), href: `/${lang}/sales/invoices/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('invoices') },
        ]}
      />
      <InvoicesTable
        invoices={result.rows}
        lang={lang}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        totalPages={result.totalPages}
      />
    </div>
  )
}
