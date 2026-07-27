import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'
import { PageHeader } from '@/components/shared/page-header'
import { CategoryForm } from '@/components/inventory/category-form'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('addCategory') }
}

export default async function NewCategoryPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const t = await getTranslations('inventory')
  const tCommon = await getTranslations('common')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addCategory')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/inventory` },
          { label: t('categories'), href: `/${lang}/inventory/categories` },
          { label: tCommon('add') },
        ]}
      />
      <div className="px-4 md:px-8">
        <CategoryForm lang={lang} />
      </div>
    </div>
  )
}
