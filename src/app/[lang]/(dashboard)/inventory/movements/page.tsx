import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { MovementsTable } from '@/components/inventory/movements-table'
import { getCachedMovements } from '@/lib/data/queries'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('stockMovements') }
}

export default async function MovementsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const [t, movements] = await Promise.all([
    getTranslations('inventory'),
    getCachedMovements(),
  ])

  return (
    <div>
      <PageHeader
        title={t('stockMovements')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/inventory` },
          { label: t('stockMovements') },
        ]}
      />
      <MovementsTable movements={movements} />
    </div>
  )
}
