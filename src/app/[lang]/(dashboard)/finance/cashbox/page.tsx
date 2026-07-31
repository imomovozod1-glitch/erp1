import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { CashboxClient } from '@/components/finance/cashbox-client'

export const metadata: Metadata = { title: 'Cashbox' }

export default async function CashboxPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations('finance')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('cashbox')}
        subtitle={t('title')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('cashbox') },
        ]}
      />
      <div className="px-4 md:px-8">
        <CashboxClient lang={lang} />
      </div>
    </div>
  )
}
