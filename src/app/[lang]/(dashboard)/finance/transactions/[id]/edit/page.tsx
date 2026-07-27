import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { TransactionForm } from '@/components/finance/transaction-form'
import { getCachedTransactionById } from '@/lib/data/queries'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'finance' })
  return { title: 'Edit Transaction' }
}

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const [t, tCommon, transaction] = await Promise.all([
    getTranslations('finance'),
    getTranslations('common'),
    getCachedTransactionById(id),
  ])

  if (!transaction) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Transaction"
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/finance` },
          { label: t('transactions'), href: `/${lang}/finance/transactions` },
          { label: tCommon('edit') },
        ]}
      />
      <div className="px-4 md:px-8">
        <TransactionForm initialData={transaction} lang={lang} />
      </div>
    </div>
  )
}
