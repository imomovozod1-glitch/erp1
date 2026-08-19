import { getCachedSupplierDetails } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { SupplierDetailClient } from '@/components/procurement/supplier-detail-client'
import { PageHeader } from '@/components/shared/page-header'
import { PageClock } from '@/components/shared/page-clock'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

interface SupplierDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const { id, lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const t = await getTranslations('procurement')
  const details = await getCachedSupplierDetails(id, tenantId)

  if (!details || !details.supplier) {
    notFound()
  }

  const { supplier, purchaseOrders, transactions } = details

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={supplier.name}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('suppliers', { fallback: 'Yetkazib beruvchilar' }), href: `/${lang}/procurement/suppliers` },
          { label: supplier.name }
        ]}
      >
        <PageClock lang={lang} />
      </PageHeader>

      <SupplierDetailClient
        lang={lang}
        supplier={supplier}
        purchaseOrders={purchaseOrders}
        transactions={transactions}
      />
    </div>
  )
}
