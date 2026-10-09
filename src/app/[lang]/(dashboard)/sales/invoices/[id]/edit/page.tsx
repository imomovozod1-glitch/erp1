import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { InvoiceForm } from '@/components/sales/invoice-form'
import { getCachedInvoiceById, getCachedCustomersForSelect, getCachedOrdersForSelect, getAssignableUsers } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'sales' })
  return { title: t('editInvoice') }
}

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('sales', lang, '/sales/invoices')
  const tenantId = await getCurrentTenantId() as string
  const [t, tCommon, invoice, customers, orders, assignableUsers] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getCachedInvoiceById(id, tenantId),
    getCachedCustomersForSelect(tenantId),
    getCachedOrdersForSelect(tenantId),
    getAssignableUsers(tenantId),
  ])

  if (!invoice) {
    notFound()
  }

  // The picker holds the newest 500 live orders; an invoice linked to an older
  // or cancelled one must still show it, or the select would read blank and
  // saving would look like it unlinks the order.
  const linkedOrderId: string | null = (invoice as any).order_id ?? null
  const orderOptions =
    linkedOrderId && !orders.some((o) => o.id === linkedOrderId)
      ? [
          ...orders,
          {
            id: linkedOrderId,
            order_number: (invoice as any).sales_orders?.order_number ?? linkedOrderId,
          },
        ]
      : orders

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('editInvoice')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/sales` },
          { label: t('invoices'), href: `/${lang}/sales/invoices` },
          { label: tCommon('edit') },
        ]}
      />
      <InvoiceForm initialData={invoice} customers={customers} orders={orderOptions} lang={lang} assignableUsers={assignableUsers} />
    </div>
  )
}
