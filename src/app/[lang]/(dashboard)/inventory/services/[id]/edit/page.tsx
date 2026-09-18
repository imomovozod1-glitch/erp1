import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { ServiceForm } from '@/components/inventory/service-form'
import { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'
import { getAssignableUsers, getCachedProductFormOptions } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('editService') }
}

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const tenantId = (await getCurrentTenantId()) as string
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('inventory', lang, '/inventory/services')
  // `is_service` postdates the generated Supabase types (database.types.ts is
  // stale — it has no tenant_id or assigned_to either), so the builder is cast
  // the same way the rest of the app does it.
  const supabase = (await createClient()) as any

  const [t, tCommon, assignableUsers, options, serviceRes, categoriesRes] = await Promise.all([
    getTranslations('inventory'),
    getTranslations('common'),
    getAssignableUsers(tenantId),
    getCachedProductFormOptions(tenantId),
    // `is_service` is part of the lookup, not just the payload: /services/<id>
    // must not become a second, stock-less editor for an ordinary product.
    supabase.from('products').select('*').eq('id', id).eq('is_service', true).maybeSingle() as any,
    supabase.from('categories').select('id, name').order('name') as any,
  ])

  if (!serviceRes.data) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('editService')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/inventory` },
          { label: t('services'), href: `/${lang}/inventory/services` },
          { label: tCommon('edit') },
        ]}
      />
      <ServiceForm
        initialData={serviceRes.data}
        categories={categoriesRes.data || []}
        lang={lang}
        assignableUsers={assignableUsers}
        options={options}
      />
    </div>
  )
}
