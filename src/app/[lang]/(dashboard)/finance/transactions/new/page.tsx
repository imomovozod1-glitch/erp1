import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { TransactionForm } from '@/components/finance/transaction-form'
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'finance' })
  return { title: t('addTransaction') }
}

export default async function NewTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const { lang } = await params
  const { type } = await searchParams
  const [t, tCommon] = await Promise.all([
    getTranslations('finance'),
    getTranslations('common'),
  ])

  const defaultType = type === 'expense' ? 'expense' : 'income'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addTransaction')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/finance` },
          { label: t('transactions'), href: `/${lang}/finance/transactions` },
          { label: tCommon('add') },
        ]}
      />
      <div className="px-4 md:px-8">
        <TransactionForm lang={lang} defaultType={defaultType} />
      </div>
    </div>
  )
}
