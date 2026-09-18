import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { BomForm } from '@/components/production/bom-form'
import { Metadata } from 'next'
import { getCachedProductsForSelect, getAssignableUsers } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'production' })
  return { title: t('addBom') }
}

export default async function NewBomPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  // Set when the form was opened from a product's own "Tarkib" card.
  const rawProduct = Array.isArray(sp.product) ? sp.product[0] : sp.product
  await requireModuleEdit('production', lang, '/production/boms')
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tCommon, products, assignableUsers] = await Promise.all([
    getTranslations('production'),
    getTranslations('common'),
    // Services included: a recipe may charge subcontracted work (delivery,
    // installation) as a component even though it holds no stock.
    getCachedProductsForSelect(tenantId, { includeServices: true }),
    getAssignableUsers(tenantId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addBom')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/production` },
          { label: t('boms'), href: `/${lang}/production/boms` },
          { label: tCommon('add') },
        ]}
      />
      <BomForm
        products={products}
        presetProductId={products.some((p) => p.id === rawProduct) ? rawProduct : undefined}
        lang={lang}
        assignableUsers={assignableUsers}
      />
    </div>
  )
}
