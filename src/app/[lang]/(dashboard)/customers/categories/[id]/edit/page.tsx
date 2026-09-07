import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { CustomerCategoryForm } from '@/components/sales/customer-category-form'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'sales' })
  return { title: t('editCustomerCategory') }
}

export default async function EditCustomerCategoryPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('customers', lang, '/customers/categories')
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getTranslations('nav'),
  ])
  const supabase = await createClient()

  const { data: category } = await supabase
    .from('customer_categories' as any)
    .select('*')
    .eq('id', id)
    .single()

  if (!category) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tCommon('edit')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: tNav('customers'), href: `/${lang}/customers` },
          { label: t('customerCategories'), href: `/${lang}/customers/categories` },
          { label: tCommon('edit') },
        ]}
      />
      <CustomerCategoryForm initialData={category} lang={lang} />
    </div>
  )
}
