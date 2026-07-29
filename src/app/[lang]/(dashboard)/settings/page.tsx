import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations('settings')

  return (
    <div>
      <PageHeader
        title={t('title')}
        breadcrumbs={[{ label: 'ERP', href: `/${lang}/dashboard` }, { label: t('title') }]}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { key: 'company', href: `/${lang}/settings/company` },
          { key: 'users', href: `/${lang}/settings/users` },
          { key: 'profile', href: `/${lang}/settings/profile` },
          { key: 'security', href: `/${lang}/settings/security` },
        ].map((item) => (
          <a
            key={item.key}
            href={item.href}
            className="block p-6 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 group"
          >
            <h3 className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
              {t(item.key as any)}
            </h3>
          </a>
        ))}
      </div>
    </div>
  )
}
