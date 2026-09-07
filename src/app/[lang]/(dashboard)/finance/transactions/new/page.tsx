import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { TransactionForm } from '@/components/finance/transaction-form'
import { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'
import { getAssignableUsers } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

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
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('finance', lang, '/finance/transactions')
  const { type } = await searchParams
  const tenantId = (await getCurrentTenantId()) as string
  const [t, tCommon, assignableUsers] = await Promise.all([
    getTranslations('finance'),
    getTranslations('common'),
    getAssignableUsers(tenantId),
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
      <TransactionForm lang={lang} defaultType={defaultType} assignableUsers={assignableUsers} />
    </div>
  )
}
