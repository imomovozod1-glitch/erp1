import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { CustomerCategoryForm } from '@/components/sales/customer-category-form'

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
      <div className="px-4 md:px-8">
        <CustomerCategoryForm initialData={category} lang={lang} />
      </div>
    </div>
  )
}
