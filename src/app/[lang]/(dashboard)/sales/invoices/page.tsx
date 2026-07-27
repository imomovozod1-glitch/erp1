import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { InvoicesTable } from '@/components/sales/invoices-table'
import { getCachedInvoices } from '@/lib/data/queries'

export const revalidate = 30

export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, invoices] = await Promise.all([
    getTranslations('sales'),
    getCachedInvoices(),
  ])

  return (
    <div>
      <PageHeader
        title={t('invoices')}
        subtitle={t('title')}
        action={{ label: t('addInvoice'), href: `/${lang}/sales/invoices/new`, icon: Plus }}
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
