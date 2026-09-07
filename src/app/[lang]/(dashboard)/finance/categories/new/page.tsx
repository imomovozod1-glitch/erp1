import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'
import { PageHeader } from '@/components/shared/page-header'
import { TransactionCategoryForm } from '@/components/finance/transaction-category-form'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'finance' })
  return { title: t('addTxCategory') }
}

export default async function NewTransactionCategoryPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('finance', lang, '/finance/categories')
  const t = await getTranslations('finance')
  const tCommon = await getTranslations('common')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addTxCategory')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/finance/cashbox` },
          { label: t('txCategories'), href: `/${lang}/finance/categories` },
          { label: tCommon('add') },
        ]}
      />
      <TransactionCategoryForm lang={lang} />
    </div>
  )
}
