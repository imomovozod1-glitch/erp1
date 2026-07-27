import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { PurchaseOrderForm } from '@/components/procurement/purchase-order-form'
import { getCachedSuppliersForSelect, getCachedProductsForSelect } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'New Purchase Order' }

export default async function NewPurchaseOrderPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, suppliers, products] = await Promise.all([
    getTranslations('procurement'),
    getCachedSuppliersForSelect(),
    getCachedProductsForSelect(),
  ])

  return (
    <div>
      <PageHeader
        title={t('addPurchase')}
        subtitle={t('title')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('purchases'), href: `/${lang}/procurement/purchase-orders` },
          { label: t('addPurchase') },
        ]}
      />
      <PurchaseOrderForm suppliers={suppliers} products={products} lang={lang} />
    </div>
  )
}
