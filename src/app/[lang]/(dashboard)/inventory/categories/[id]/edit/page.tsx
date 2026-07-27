import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { CategoryForm } from '@/components/inventory/category-form'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('editCategory') }
}

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const t = await getTranslations('inventory')
  const tCommon = await getTranslations('common')
  const supabase = await createClient()

  const { data: category } = await supabase
    .from('categories')
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
          { label: t('title'), href: `/${lang}/inventory` },
          { label: t('categories'), href: `/${lang}/inventory/categories` },
          { label: tCommon('edit') },
        ]}
      />
      <div className="px-4 md:px-8">
        <CategoryForm initialData={category} lang={lang} />
      </div>
    </div>
  )
}
