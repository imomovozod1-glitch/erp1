import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { OrderForm } from '@/components/sales/order-form'
import { getCachedOrderById, getCachedCustomersForSelect } from '@/lib/data/queries'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'sales' })
  return { title: 'Edit Order' } // Or t('editOrder') if it exists
}

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const [t, tCommon, order, customers] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getCachedOrderById(id),
    getCachedCustomersForSelect(),
  ])

  if (!order) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Order"
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/sales` },
          { label: t('orders'), href: `/${lang}/sales/orders` },
          { label: tCommon('edit') },
        ]}
      />
      <div className="px-4 md:px-8">
        <OrderForm initialData={order} customers={customers} lang={lang} />
      </div>
    </div>
  )
}
