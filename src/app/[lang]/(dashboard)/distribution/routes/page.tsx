import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { RoutesTable } from '@/components/distribution/routes-table'
import { getRoutesPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'distribution' })
  return { title: t('routes') }
}

export default async function RoutesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  const { page, pageSize, search } = readPageParams(sp)
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tInfo, canEdit, routesPage] = await Promise.all([
    getTranslations('distribution'),
    getTranslations('pageInfo'),
    canEditModule('distribution'),
    getRoutesPage(tenantId, { page, pageSize, search }),
  ])

  return (
    <div>
      <PageHeader
        title={t('routes')}
        subtitle={t('title')}
        info={tInfo('routes')}
        action={canEdit ? { label: t('addRoute'), href: `/${lang}/distribution/routes/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('routes') },
        ]}
      />
      <RoutesTable
        routes={routesPage.rows}
        lang={lang}
        page={routesPage.page}
        pageSize={routesPage.pageSize}
        total={routesPage.total}
        totalPages={routesPage.totalPages}
      />
    </div>
  )
}
