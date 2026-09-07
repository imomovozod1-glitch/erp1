import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { InvoiceForm } from '@/components/sales/invoice-form'
import { getCachedCustomersForSelect, getCachedOrders } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'sales' })
  return { title: t('addInvoice') }
}

export default async function NewInvoicePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('sales', lang, '/sales/invoices')
  const tenantId = await getCurrentTenantId() as string
  const [t, tCommon, customers, orders] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getCachedCustomersForSelect(tenantId),
    getCachedOrders(tenantId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addInvoice')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/sales` },
          { label: t('invoices'), href: `/${lang}/sales/invoices` },
          { label: tCommon('add') },
        ]}
      />
      <div className="px-4 md:px-8">
        <InvoiceForm customers={customers} orders={orders} lang={lang} />
      </div>
    </div>
  )
}
