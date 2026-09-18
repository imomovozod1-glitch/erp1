import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { BomsTable } from '@/components/production/boms-table'
import { getCachedBoms } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'production' })
  return { title: t('boms') }
}

export default async function BomsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tInfo, canEdit, boms] = await Promise.all([
    getTranslations('production'),
    getTranslations('pageInfo'),
    canEditModule('production'),
    // The whole list, like the role templates page — see `BomsTable`.
    getCachedBoms(tenantId),
  ])

  return (
    <div>
      <PageHeader
        title={t('boms')}
        subtitle={t('title')}
        info={tInfo('boms')}
        action={canEdit ? { label: t('addBom'), href: `/${lang}/production/boms/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('boms') },
        ]}
      />
      <BomsTable boms={boms} lang={lang} />
    </div>
  )
}
