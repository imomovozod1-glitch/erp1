import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { BomsTable } from '@/components/production/boms-table'
import { getBomsPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canResource } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'production' })
  return { title: t('boms') }
}

export default async function BomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  const { page, pageSize, search } = readPageParams(sp)
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tInfo, bomsPage] = await Promise.all([
    getTranslations('production'),
    getTranslations('pageInfo'),
    getBomsPage(tenantId, { page, pageSize, search }),
  ])

  return (
    <div>
      <PageHeader
        title={t('boms')}
        subtitle={t('title')}
        info={tInfo('boms')}
        action={(await canResource('production', 'boms', 'create')) ? { label: t('addBom'), href: `/${lang}/production/boms/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'Falco', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('boms') },
        ]}
      />
      <BomsTable
        boms={bomsPage.rows}
        lang={lang}
        page={bomsPage.page}
        pageSize={bomsPage.pageSize}
        total={bomsPage.total}
        totalPages={bomsPage.totalPages}
      />
    </div>
  )
}
