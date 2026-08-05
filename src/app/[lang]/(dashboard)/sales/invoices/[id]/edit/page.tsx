import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { InvoiceForm } from '@/components/sales/invoice-form'
import { getCachedInvoiceById, getCachedCustomersForSelect, getCachedOrders } from '@/lib/data/queries'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

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
  const [t, tCommon, invoice, customers, orders] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getCachedInvoiceById(id),
    getCachedCustomersForSelect(),
    getCachedOrders(),
  ])

  if (!invoice) {
    notFound()
  }

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
      <div className="px-4 md:px-8">
        <InvoiceForm initialData={invoice} customers={customers} orders={orders} lang={lang} />
      </div>
    </div>
  )
}
