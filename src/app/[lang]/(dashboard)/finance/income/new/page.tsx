import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { TransactionForm } from '@/components/finance/transaction-form'
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'finance' })
  return { title: t('addTransaction') }
}

export default async function NewIncomePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const [t, tCommon] = await Promise.all([
    getTranslations('finance'),
    getTranslations('common'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addTransaction')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/finance` },
          { label: t('income'), href: `/${lang}/finance/income` },
          { label: tCommon('add') },
        ]}
      />
      <div className="px-4 md:px-8">
        <TransactionForm lang={lang} defaultType="income" />
      </div>
    </div>
  )
}
