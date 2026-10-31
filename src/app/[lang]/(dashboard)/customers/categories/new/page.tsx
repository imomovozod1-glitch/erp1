import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'
import { PageHeader } from '@/components/shared/page-header'
import { CustomerCategoryForm } from '@/components/sales/customer-category-form'
import { requireResourceAction } from '@/lib/permissions-server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'sales' })
  return { title: t('addCustomerCategory') }
}

export default async function NewCustomerCategoryPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireResourceAction('customers', 'categories', 'create', lang, '/customers/categories')
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getTranslations('nav'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addCustomerCategory')}
        breadcrumbs={[
          { label: 'Falco', href: `/${lang}/dashboard` },
          { label: tNav('customers'), href: `/${lang}/customers` },
          { label: t('customerCategories'), href: `/${lang}/customers/categories` },
          { label: tCommon('add') },
        ]}
      />
      <CustomerCategoryForm lang={lang} />
    </div>
  )
}
