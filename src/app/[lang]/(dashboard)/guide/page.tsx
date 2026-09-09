import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
  LayoutDashboard,
  TrendingUp,
  Store,
  Package,
  Tags,
  ArrowLeftRight,
  Ruler,
  ShoppingCart,
  FileText,
  Contact,
  Layers,
  Truck,
  Building2,
  DollarSign,
  Wallet,
  ListTree,
  Users,
  ShieldCheck,
  Settings,
  LifeBuoy,
  Info,
  ArrowRight,
  Lightbulb,
  HelpCircle,
  Rocket,
  Compass,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'

export const metadata: Metadata = { title: 'Guide' }

interface GuideItem {
  /** Key under `guide.modules` holding the purpose/steps/tips for this page. */
  key: string
  icon: LucideIcon
  /** Display name, reused from the namespace the page itself uses. */
  labelKey: [string, string]
  href: string
}

interface GuideSection {
  titleKey: [string, string]
  items: GuideItem[]
}

const SECTIONS: GuideSection[] = [
  {
    titleKey: ['nav', 'dashboard'],
    items: [
      { key: 'dashboard', icon: LayoutDashboard, labelKey: ['nav', 'dashboard'], href: 'dashboard' },
      { key: 'analytics', icon: TrendingUp, labelKey: ['nav', 'reports'], href: 'reports' },
      { key: 'pos', icon: Store, labelKey: ['nav', 'pos'], href: 'pos' },
    ],
  },
  {
    titleKey: ['nav', 'inventory'],
    items: [
      { key: 'products', icon: Package, labelKey: ['inventory', 'products'], href: 'inventory/products' },
      { key: 'categories', icon: Tags, labelKey: ['inventory', 'categories'], href: 'inventory/categories' },
      { key: 'movements', icon: ArrowLeftRight, labelKey: ['inventory', 'stockMovements'], href: 'inventory/movements' },
      { key: 'units', icon: Ruler, labelKey: ['inventory', 'unit'], href: 'inventory/units' },
    ],
  },
  {
    titleKey: ['nav', 'sales'],
    items: [
      { key: 'salesOrders', icon: ShoppingCart, labelKey: ['sales', 'orders'], href: 'sales/orders' },
      { key: 'invoices', icon: FileText, labelKey: ['sales', 'invoices'], href: 'sales/invoices' },
    ],
  },
  {
    titleKey: ['nav', 'customers'],
    items: [
      { key: 'customers', icon: Contact, labelKey: ['nav', 'customers'], href: 'customers' },
      { key: 'customerCategories', icon: Layers, labelKey: ['sales', 'customerCategories'], href: 'customers/categories' },
    ],
  },
  {
    titleKey: ['nav', 'procurement'],
    items: [
      { key: 'purchaseOrders', icon: Truck, labelKey: ['procurement', 'purchases'], href: 'procurement/purchase-orders' },
      { key: 'suppliers', icon: Building2, labelKey: ['procurement', 'suppliers'], href: 'procurement/suppliers' },
    ],
  },
  {
    titleKey: ['nav', 'finance'],
    items: [
      { key: 'cashbox', icon: Wallet, labelKey: ['finance', 'cashbox'], href: 'finance/cashbox' },
      { key: 'transactions', icon: DollarSign, labelKey: ['finance', 'transactions'], href: 'finance/transactions' },
      { key: 'txCategories', icon: ListTree, labelKey: ['finance', 'txCategories'], href: 'finance/categories' },
    ],
  },
  {
    titleKey: ['nav', 'hr'],
    items: [
      { key: 'employees', icon: Users, labelKey: ['hr', 'employees'], href: 'hr/employees' },
      { key: 'roles', icon: ShieldCheck, labelKey: ['hr', 'roles'], href: 'hr/roles' },
    ],
  },
  {
    titleKey: ['nav', 'settings'],
    items: [
      { key: 'settings', icon: Settings, labelKey: ['nav', 'settings'], href: 'settings' },
      { key: 'support', icon: LifeBuoy, labelKey: ['support', 'title'], href: 'support' },
    ],
  },
]

const CARD = 'rounded-xl border-0 shadow-sm bg-white dark:bg-slate-900'
const SECTION_HEADING =
  'text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider'

export default async function GuidePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, tFaq, tNav, tInventory, tSales, tFinance, tHr, tProcurement, tSupport] = await Promise.all([
    getTranslations('guide'),
    getTranslations('faq'),
    getTranslations('nav'),
    getTranslations('inventory'),
    getTranslations('sales'),
    getTranslations('finance'),
    getTranslations('hr'),
    getTranslations('procurement'),
    getTranslations('support'),
  ])

  const namespaces: Record<string, (key: string) => string> = {
    nav: tNav,
    inventory: tInventory,
    sales: tSales,
    finance: tFinance,
    hr: tHr,
    procurement: tProcurement,
    support: tSupport,
  }

  const label = ([ns, key]: [string, string]) => namespaces[ns](key)

  // The long-form content is authored as arrays in messages/{uz,ru,en}.json, so
  // `raw` is the only way to read it — `t()` would stringify the array.
  const quickStartSteps = t.raw('quickStart.steps') as { title: string; text: string }[]
  const basicsItems = t.raw('basics.items') as { title: string; text: string }[]

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: 'ERP', href: `/${lang}/dashboard` }, { label: t('title') }]}
      />

      <div className="flex items-start gap-3 rounded-xl border-0 shadow-sm bg-violet-50 dark:bg-violet-950/30 p-4">
        <Info className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
        <p className="text-sm text-violet-900 dark:text-violet-200 leading-relaxed">{t('intro')}</p>
      </div>

      {/* Table of contents — anchors to every module section below. */}
      <div className={`${CARD} p-5`}>
        <h2 className={`${SECTION_HEADING} mb-3 flex items-center gap-2`}>
          <Compass className="h-4 w-4" /> {t('tocTitle')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <a
            href="#quick-start"
            className="rounded-lg bg-violet-50 dark:bg-violet-950/40 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/50"
          >
            {t('quickStart.title')}
          </a>
          <a
            href="#basics"
            className="rounded-lg bg-violet-50 dark:bg-violet-950/40 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/50"
          >
            {t('basics.title')}
          </a>
          {SECTIONS.flatMap((section) => section.items).map((item) => (
            <a
              key={item.key}
              href={`#${item.key}`}
              className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {label(item.labelKey)}
            </a>
          ))}
          <a
            href="#faq"
            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            {tFaq('title')}
          </a>
        </div>
      </div>

      {/* Getting started */}
      <section id="quick-start" className={`${CARD} scroll-mt-24 p-5`}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {t('quickStart.title')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {t('quickStart.description')}
            </p>
          </div>
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {quickStartSteps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Rules that apply on every page */}
      <section id="basics" className="scroll-mt-24">
        <h2 className={`${SECTION_HEADING} mb-1`}>{t('basics.title')}</h2>
        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
          {t('basics.description')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {basicsItems.map((item) => (
            <div key={item.title} className={`${CARD} p-4`}>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* One detailed card per page of the app */}
      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.titleKey.join('.')}>
            <h2 className={`${SECTION_HEADING} mb-3`}>{label(section.titleKey)}</h2>
            <div className="space-y-4">
              {section.items.map((item) => {
                const Icon = item.icon
                const steps = t.raw(`modules.${item.key}.steps`) as string[]
                const tips = t.raw(`modules.${item.key}.tips`) as string[]
                return (
                  <article key={item.key} id={item.key} className={`${CARD} scroll-mt-24 p-5`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                            {label(item.labelKey)}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {t(`modules.${item.key}.purpose`)}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/${lang}/${item.href}`}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/50"
                      >
                        {t('openLink')}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className={`${SECTION_HEADING} mb-2 text-xs`}>{t('stepsTitle')}</p>
                        <ol className="space-y-2">
                          {steps.map((step, index) => (
                            <li key={step} className="flex gap-2.5 text-sm">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                {index + 1}
                              </span>
                              <span className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                {step}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div>
                        <p className={`${SECTION_HEADING} mb-2 text-xs`}>{t('tipsTitle')}</p>
                        <ul className="space-y-2">
                          {tips.map((tip) => (
                            <li key={tip} className="flex gap-2.5 text-sm">
                              <Lightbulb className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                              <span className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                {tip}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* The FAQ has its own page (/faq); the guide points at it rather than
          keeping a second copy of the same answers. */}
      <section id="faq" className="scroll-mt-24">
        <Link
          href={`/${lang}/faq`}
          className={`${CARD} flex items-center justify-between gap-4 p-5 transition-shadow hover:shadow-md`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 shrink-0">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{tFaq('title')}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{tFaq('subtitle')}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
        </Link>
      </section>

    </div>
  )
}
