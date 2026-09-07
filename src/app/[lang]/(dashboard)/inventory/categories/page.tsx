import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { CategoriesTable } from '@/components/inventory/categories-table'
import { getCachedCategories } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('categories') }
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('inventory')
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, categories] = await Promise.all([
    getTranslations('inventory'),
    getTranslations('pageInfo'),
    getCachedCategories(tenantId),
  ])

  return (
    <div>
      <PageHeader
        title={t('categories')}
        subtitle={t('title')}
        info={tInfo('categories')}
        action={canEdit ? {
          label: t('addCategory'),
          href: `/${lang}/inventory/categories/new`,
          icon: Plus,
        } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/inventory` },
          { label: t('categories') },
        ]}
      />
      <CategoriesTable categories={categories} lang={lang} />
    </div>
  )
}
