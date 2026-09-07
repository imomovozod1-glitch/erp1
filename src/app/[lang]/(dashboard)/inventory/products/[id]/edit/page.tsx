import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { ProductForm } from '@/components/inventory/product-form'
import { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'

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
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('inventory', lang, '/inventory/products')
  const t = await getTranslations('inventory')
  const tCommon = await getTranslations('common')
  const supabase = await createClient()

   
  const productRes = await supabase.from('products').select('*').eq('id', id).single() as any
   
  const categoriesRes = await supabase.from('categories').select('id, name').order('name') as any

  if (!productRes.data) {
    notFound()
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
      <div className="px-4 md:px-8">
        <ProductForm 
          initialData={productRes.data} 
          categories={categoriesRes.data || []} 
          lang={lang} 
        />
      </div>
    </div>
  )
}
