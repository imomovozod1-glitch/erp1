import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { ProductForm } from '@/components/inventory/product-form'
import { Metadata } from 'next'
import { getCachedCategoriesForSelect, getAssignableUsers } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireModuleEdit } from '@/lib/permissions-server'

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
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('inventory', lang, '/inventory/products')
  const tenantId = await getCurrentTenantId() as string
  const [t, tCommon, categories, assignableUsers] = await Promise.all([
    getTranslations('inventory'),
    getTranslations('common'),
    getCachedCategoriesForSelect(tenantId),
    getAssignableUsers(tenantId),
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
      <ProductForm categories={categories} lang={lang} assignableUsers={assignableUsers} />
    </div>
  )
}

