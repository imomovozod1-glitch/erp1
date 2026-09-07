import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Building2, Users, UserCircle, ShieldCheck, Printer, Plug, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { canViewModule } from '@/lib/permissions-server'

export const metadata: Metadata = { title: 'Settings' }

const CARDS = [
  { key: 'company', href: 'company', icon: Building2, tone: 'violet' },
  { key: 'users', href: 'users', icon: Users, tone: 'blue' },
  { key: 'profile', href: 'profile', icon: UserCircle, tone: 'emerald' },
  { key: 'security', href: 'security', icon: ShieldCheck, tone: 'rose' },
  { key: 'printerTitle', href: 'printer', icon: Printer, tone: 'amber' },
  { key: 'integrationsTitle', href: 'integrations', icon: Plug, tone: 'sky' },
] as const

const TONE_STYLES: Record<string, string> = {
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
}

export default async function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, tInfo] = await Promise.all([
    getTranslations('settings'),
    getTranslations('pageInfo'),
  ])

  // Cards for the permissioned part of Settings are hidden from users without
  // the `settings` module; profile and security always stay listed, since they
  // are the user's own account and every user needs them.
  const canSeeSettingsModule = await canViewModule('settings')
  const ALWAYS_VISIBLE = new Set<string>(['profile', 'security'])
  const visibleCards = CARDS.filter(
    (card) => canSeeSettingsModule || ALWAYS_VISIBLE.has(card.key)
  )

  const cardDescriptions: Record<string, string> = {
    company: t('companyCardDesc'),
    users: t('usersCardDesc'),
    profile: t('profileCardDesc'),
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
              className="flex items-start gap-4 p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all duration-200 group"
            >
              <div className={`p-2.5 rounded-lg shrink-0 ${TONE_STYLES[item.tone]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors">
                  {t(item.key)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {cardDescriptions[item.key]}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors shrink-0 mt-1" />
            </a>
          )
        })}
      </div>
    </div>
  )
}
