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
  Settings,
  LifeBuoy,
  Info,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'

export const metadata: Metadata = { title: 'Guide' }

interface GuideItem {
  icon: LucideIcon
  labelKey: [string, string]
  infoKey: string
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
      { icon: LayoutDashboard, labelKey: ['nav', 'dashboard'], infoKey: 'dashboard', href: 'dashboard' },
      { icon: TrendingUp, labelKey: ['nav', 'analytics'], infoKey: 'analytics', href: 'analytics' },
      { icon: Store, labelKey: ['nav', 'pos'], infoKey: 'pos', href: 'pos' },
    ],
  },
  {
    titleKey: ['nav', 'inventory'],
    items: [
      { icon: Package, labelKey: ['inventory', 'products'], infoKey: 'products', href: 'inventory/products' },
      { icon: Tags, labelKey: ['inventory', 'categories'], infoKey: 'categories', href: 'inventory/categories' },
      { icon: ArrowLeftRight, labelKey: ['inventory', 'stockMovements'], infoKey: 'movements', href: 'inventory/movements' },
      { icon: Ruler, labelKey: ['inventory', 'unit'], infoKey: 'units', href: 'inventory/units' },
    ],
  },
  {
    titleKey: ['nav', 'sales'],
    items: [
      { icon: ShoppingCart, labelKey: ['sales', 'orders'], infoKey: 'salesOrders', href: 'sales/orders' },
      { icon: FileText, labelKey: ['sales', 'invoices'], infoKey: 'invoices', href: 'sales/invoices' },
    ],
  },
  {
    titleKey: ['nav', 'customers'],
    items: [
      { icon: Contact, labelKey: ['nav', 'customers'], infoKey: 'customers', href: 'customers' },
      { icon: Layers, labelKey: ['sales', 'customerCategories'], infoKey: 'customerCategories', href: 'customers/categories' },
    ],
  },
  {
    titleKey: ['nav', 'procurement'],
    items: [
      { icon: Truck, labelKey: ['procurement', 'purchases'], infoKey: 'purchaseOrders', href: 'procurement/purchase-orders' },
      { icon: Building2, labelKey: ['procurement', 'suppliers'], infoKey: 'suppliers', href: 'procurement/suppliers' },
    ],
  },
  {
    titleKey: ['nav', 'finance'],
    items: [
      { icon: Wallet, labelKey: ['finance', 'cashbox'], infoKey: 'cashbox', href: 'finance/cashbox' },
      { icon: DollarSign, labelKey: ['finance', 'transactions'], infoKey: 'transactions', href: 'finance/transactions' },
      { icon: ListTree, labelKey: ['finance', 'txCategories'], infoKey: 'txCategories', href: 'finance/categories' },
    ],
  },
  {
    titleKey: ['nav', 'hr'],
    items: [
      { icon: Users, labelKey: ['hr', 'employees'], infoKey: 'employees', href: 'hr/employees' },
    ],
  },
  {
    titleKey: ['nav', 'settings'],
    items: [
      { icon: Settings, labelKey: ['nav', 'settings'], infoKey: 'settings', href: 'settings' },
      { icon: LifeBuoy, labelKey: ['support', 'title'], infoKey: 'support', href: 'support' },
    ],
  },
]

export default async function GuidePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [tInfo, tNav, tInventory, tSales, tFinance, tHr, tProcurement, tSupport] = await Promise.all([
    getTranslations('pageInfo'),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={tInfo('guideTitle')}
        subtitle={tInfo('guideSubtitle')}
        breadcrumbs={[{ label: 'ERP', href: `/${lang}/dashboard` }, { label: tInfo('guideTitle') }]}
      />

      <div className="flex items-start gap-3 rounded-xl border-0 shadow-sm bg-violet-50 dark:bg-violet-950/30 p-4">
        <Info className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
        <p className="text-sm text-violet-900 dark:text-violet-200 leading-relaxed">{tInfo('guideIntro')}</p>
      </div>

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.titleKey.join('.')}>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              {namespaces[section.titleKey[0]](section.titleKey[1])}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={`/${lang}/${item.href}`}
                    className="flex items-start gap-3 p-4 rounded-xl border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white dark:bg-slate-900"
                  >
                    <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {namespaces[item.labelKey[0]](item.labelKey[1])}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-3">
                        {tInfo(item.infoKey)}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
