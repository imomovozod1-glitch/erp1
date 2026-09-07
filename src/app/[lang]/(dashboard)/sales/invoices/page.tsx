import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { InvoicesTable } from '@/components/sales/invoices-table'
import { getCachedInvoices } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export const revalidate = 30

export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('sales')
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, invoices] = await Promise.all([
    getTranslations('sales'),
    getTranslations('pageInfo'),
    getCachedInvoices(tenantId),
  ])

  return (
    <div>
      <PageHeader
        title={t('invoices')}
        subtitle={t('title')}
        info={tInfo('invoices')}
        action={canEdit ? { label: t('addInvoice'), href: `/${lang}/sales/invoices/new`, icon: Plus } : undefined}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('invoices') },
        ]}
      />
      <InvoicesTable invoices={invoices} lang={lang} />
    </div>
  )
}
