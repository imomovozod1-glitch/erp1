import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ServicesTable } from '@/components/inventory/services-table'
import { getServicesPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule, getDataScope, getPermissionContext } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('services') }
}

export default async function ServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])

  const { page, pageSize, search } = readPageParams(sp)
  const [scope, permCtx] = await Promise.all([getDataScope('inventory'), getPermissionContext()])
  const ownerId = scope === 'own' ? permCtx?.userId : undefined
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status
  const status = statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all'

  const canEdit = await canEditModule('inventory')
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tInfo, result] = await Promise.all([
    getTranslations('inventory'),
    getTranslations('pageInfo'),
    getServicesPage(tenantId, { page, pageSize, search, status, ownerId }),
  ])

  return (
    <div>
      <PageHeader
        title={t('services')}
        subtitle={t('title')}
        info={tInfo('services')}
        action={canEdit ? { label: t('addService'), href: `/${lang}/inventory/services/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('services') },
        ]}
      />
      <ServicesTable
        services={result.rows}
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
