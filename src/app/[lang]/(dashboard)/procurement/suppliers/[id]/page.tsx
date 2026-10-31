import { getCachedSupplierDetails } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { SupplierDetailClient } from '@/components/procurement/supplier-detail-client'
import { PageHeader } from '@/components/shared/page-header'
import { canEditRecord } from '@/lib/permissions-server'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Pencil } from 'lucide-react'

interface SupplierDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const { id, lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const [t, tCommon, details] = await Promise.all([
    getTranslations('procurement'),
    getTranslations('common'),
    getCachedSupplierDetails(id, tenantId),
  ])

  if (!details || !details.supplier) {
    notFound()
  }

  const { supplier, purchaseOrders, transactions } = details
  const canEdit = await canEditRecord('procurement', 'suppliers', supplier.assigned_to)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={supplier.name}
        action={canEdit ? { label: tCommon('edit'), href: `/${lang}/procurement/suppliers/${id}/edit`, icon: Pencil } : undefined}
        breadcrumbs={[
          { label: 'Falco', href: `/${lang}/dashboard` },
          { label: t('suppliers'), href: `/${lang}/procurement/suppliers` },
          { label: supplier.name }
        ]}
      />

      <SupplierDetailClient
        lang={lang}
        supplier={supplier}
        purchaseOrders={purchaseOrders}
        transactions={transactions}
      />
    </div>
  )
}
