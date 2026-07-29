import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSessionUser } from '@/lib/auth'
import { PageHeader } from '@/components/shared/page-header'
import { UnitsList } from '@/components/inventory/units-list'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('unit') }
}

export default async function UnitsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const user = await getSessionUser()

  if (!user) {
    redirect(`/${lang}/login`)
  }

  const t = await getTranslations('inventory')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('unit')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/inventory/products` },
          { label: t('unit') },
        ]}
      />
      <UnitsList lang={lang} />
    </div>
  )
}
