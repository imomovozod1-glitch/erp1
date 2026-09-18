import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { ProductForm } from '@/components/inventory/product-form'
import { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'
import { getAssignableUsers, getCachedProductFormOptions } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('editProduct') }
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const tenantId = (await getCurrentTenantId()) as string
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('inventory', lang, '/inventory/products')
  const supabase = await createClient()

  // Six awaits in a row became one batch: none of these depends on another's
  // result, and each Supabase call is a ~500 ms round trip, so serialising them
  // was pure waiting.
  const [t, tCommon, assignableUsers, options, productRes, categoriesRes] = await Promise.all([
    getTranslations('inventory'),
    getTranslations('common'),
    getAssignableUsers(tenantId),
    getCachedProductFormOptions(tenantId),
    supabase.from('products').select('*').eq('id', id).single() as any,
    supabase.from('categories').select('id, name').order('name') as any,
  ])

  if (!productRes.data) {
    notFound()
  }
  // Same as the detail page: a service belongs in the services form, which has
  // no stock fields for the database to reject.
  if (productRes.data.is_service) {
    redirect(`/${lang}/inventory/services/${id}/edit`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tCommon('edit')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/inventory` },
          { label: t('products'), href: `/${lang}/inventory/products` },
          { label: tCommon('edit') },
        ]}
      />
      <ProductForm
        initialData={productRes.data}
        categories={categoriesRes.data || []}
        lang={lang}
        assignableUsers={assignableUsers}
        options={options}
      />
    </div>
  )
}
