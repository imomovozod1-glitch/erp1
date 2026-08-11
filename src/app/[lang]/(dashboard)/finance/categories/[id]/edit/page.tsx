import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { TransactionCategoryForm } from '@/components/finance/transaction-category-form'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'finance' })
  return { title: t('editTxCategory') }
}

export default async function EditTransactionCategoryPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const t = await getTranslations('finance')
  const tCommon = await getTranslations('common')
  const supabase = await createClient()

  const { data: category } = await supabase
    .from('transaction_categories')
    .select('*')
    .eq('id', id)
    .single()

  if (!category) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tCommon('edit')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/finance/cashbox` },
          { label: t('txCategories'), href: `/${lang}/finance/categories` },
          { label: tCommon('edit') },
        ]}
      />
      <div className="px-4 md:px-8">
        <TransactionCategoryForm initialData={category} lang={lang} />
      </div>
    </div>
  )
}
