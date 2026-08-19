import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { ProductForm } from '@/components/inventory/product-form'
import { Metadata } from 'next'
import { getCachedCategoriesForSelect } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('addProduct') }
}

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const [t, tCommon, categories] = await Promise.all([
    getTranslations('inventory'),
    getTranslations('common'),
    getCachedCategoriesForSelect(tenantId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addProduct')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/inventory` },
          { label: t('products'), href: `/${lang}/inventory/products` },
          { label: tCommon('add') },
        ]}
      />
      <div className="px-4 md:px-8">
        <ProductForm categories={categories} lang={lang} />
      </div>
    </div>
  )
}

