import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { CustomerCategoriesTable } from '@/components/sales/customer-categories-table'
import { getCachedCustomerCategories } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'sales' })
  return { title: t('customerCategories') }
}

export default async function CustomerCategoriesPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('customers')
  const tenantId = await getCurrentTenantId() as string
  const [t, tNav, tInfo, categories] = await Promise.all([
    getTranslations('sales'),
    getTranslations('nav'),
    getTranslations('pageInfo'),
    getCachedCustomerCategories(tenantId),
  ])

  return (
    <div>
      <PageHeader
        title={t('customerCategories')}
        subtitle={t('customers')}
        info={tInfo('customerCategories')}
        action={canEdit ? {
          label: t('addCustomerCategory'),
          href: `/${lang}/customers/categories/new`,
          icon: Plus,
        } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: tNav('customers'), href: `/${lang}/customers` },
          { label: t('customerCategories') },
        ]}
      />
      <CustomerCategoriesTable categories={categories} lang={lang} />
    </div>
  )
}
