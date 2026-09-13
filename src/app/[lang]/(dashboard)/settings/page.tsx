import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Building2, ShieldCheck, ReceiptText, Plug, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { canViewModule } from '@/lib/permissions-server'

export const metadata: Metadata = { title: 'Settings' }

/**
 * Settings index.
 *
 * Profile and user management used to live here and no longer do — personal
 * details and the user list were removed from the product, so the cards and
 * their pages went with them. Security stays, because changing your own
 * password is something every account needs regardless of permissions.
 *
 * One accent colour for every card, not six: a settings index is a list of
 * destinations, and a different hue per row made it read as six unrelated
 * states rather than one menu.
 */
const CARDS = [
  { key: 'company', href: 'company', icon: Building2 },
  { key: 'printerTitle', href: 'printer', icon: ReceiptText },
  { key: 'integrationsTitle', href: 'integrations', icon: Plug },
  { key: 'security', href: 'security', icon: ShieldCheck },
] as const

export default async function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, tInfo] = await Promise.all([
    getTranslations('settings'),
    getTranslations('pageInfo'),
  ])

  // Cards for the permissioned part of Settings are hidden from users without
  // the `settings` module; security always stays listed, since it is the
  // user's own account and every user needs it.
  const canSeeSettingsModule = await canViewModule('settings')
  const ALWAYS_VISIBLE = new Set<string>(['security'])
  const visibleCards = CARDS.filter(
    (card) => canSeeSettingsModule || ALWAYS_VISIBLE.has(card.key)
  )

  const cardDescriptions: Record<string, string> = {
    company: t('companyCardDesc'),
    security: t('securityCardDesc'),
    printerTitle: t('printerCardDesc'),
    integrationsTitle: t('integrationsCardDesc'),
  }

  return (
    <div>
      <PageHeader
        title={t('title')}
        info={tInfo('settings')}
        breadcrumbs={[{ label: 'ERP', href: `/${lang}/dashboard` }, { label: t('title') }]}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((item) => {
          const Icon = item.icon
          return (
            <a
              key={item.key}
              href={`/${lang}/settings/${item.href}`}
              className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-colors duration-200 hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-700"
            >
              <div className="shrink-0 rounded-lg bg-slate-100 p-2.5 text-slate-600 transition-colors group-hover:bg-violet-50 group-hover:text-violet-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-violet-950/40 dark:group-hover:text-violet-400">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t(item.key)}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {cardDescriptions[item.key]}
                </p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-violet-500 dark:text-slate-600 dark:group-hover:text-violet-400" />
            </a>
          )
        })}
      </div>
    </div>
  )
}
