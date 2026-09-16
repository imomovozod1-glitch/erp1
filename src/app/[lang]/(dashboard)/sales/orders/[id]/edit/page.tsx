import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { OrderForm } from '@/components/sales/order-form'
import { getCachedOrderById, getCachedCustomersForSelect, getAssignableUsers, getOrderItemsForEdit } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'sales' })
  return { title: t('editOrder') } // Or t('editOrder') if it exists
}

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('sales', lang, '/sales/orders')
  const tenantId = await getCurrentTenantId() as string
  const [t, tCommon, order, customers, assignableUsers, items] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getCachedOrderById(id, tenantId),
    getCachedCustomersForSelect(tenantId),
    getAssignableUsers(tenantId),
    getOrderItemsForEdit(id, tenantId),
  ])

  if (!order) {
    notFound()
  }
  // A cancelled sale is fully reversed (stock, cashbox, debt) — editing it
  // would move stock and money again, so it is read-only.
  if ((order as { status?: string }).status === 'cancelled') {
    redirect(`/${lang}/sales/orders/${id}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('editOrder')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/sales` },
          { label: t('orders'), href: `/${lang}/sales/orders` },
          { label: tCommon('edit') },
        ]}
      />
      <OrderForm initialData={order} items={items} customers={customers} lang={lang} assignableUsers={assignableUsers} />
    </div>
  )
}
