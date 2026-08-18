import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSessionUser } from '@/lib/auth'
import { PageHeader } from '@/components/shared/page-header'
import { CompanyForm } from '@/components/settings/company-form'
import { InventoryCostingForm } from '@/components/settings/inventory-costing-form'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'settings' })
  return { title: t('company') }
}

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const user = await getSessionUser()

  if (!user) {
    redirect(`/${lang}/login`)
  }

  const t = await getTranslations('settings')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('company')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/settings` },
          { label: t('company') },
        ]}
      />
      <CompanyForm />
      <InventoryCostingForm />
    </div>
  )
}
