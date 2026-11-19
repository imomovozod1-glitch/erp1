import { LayoutDashboard, TrendingUp, Store, Package, Wrench, Factory, Tags, ArrowLeftRight, Ruler, ShoppingCart, FileText, Contact, Layers, Truck, Route, Building2, DollarSign, Wallet, ListTree, Users, ShieldCheck, Settings, LifeBuoy, type LucideIcon } from 'lucide-react'

export interface GuideItem {
  /** Key under `guide.modules` holding the purpose/steps/tips for this page. */
  key: string
  icon: LucideIcon
  /** Display name, reused from the namespace the page itself uses. */
  labelKey: string
  href: string
}

export interface GuideSection {
  titleKey: string
  items: GuideItem[]
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    titleKey: 'nav.dashboard',
    items: [
      { key: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', href: 'dashboard' },
      { key: 'analytics', icon: TrendingUp, labelKey: 'nav.reports', href: 'reports' },
      { key: 'pos', icon: Store, labelKey: 'nav.pos', href: 'pos' },
    ],
  },
  {
    titleKey: 'nav.inventory',
    items: [
      { key: 'products', icon: Package, labelKey: 'inventory.products', href: 'inventory/products' },
      { key: 'services', icon: Wrench, labelKey: 'inventory.services', href: 'inventory/services' },
      { key: 'categories', icon: Tags, labelKey: 'inventory.categories', href: 'inventory/categories' },
      { key: 'movements', icon: ArrowLeftRight, labelKey: 'inventory.stockMovements', href: 'inventory/movements' },
      { key: 'units', icon: Ruler, labelKey: 'inventory.unit', href: 'inventory/units' },
    ],
  },
  {
    titleKey: 'nav.sales',
    items: [
      { key: 'salesOrders', icon: ShoppingCart, labelKey: 'sales.orders', href: 'sales/orders' },
      { key: 'invoices', icon: FileText, labelKey: 'sales.invoices', href: 'sales/invoices' },
    ],
  },
  {
    titleKey: 'nav.customers',
    items: [
      { key: 'customers', icon: Contact, labelKey: 'nav.customers', href: 'customers' },
      { key: 'customerCategories', icon: Layers, labelKey: 'sales.customerCategories', href: 'customers/categories' },
    ],
  },
  {
    titleKey: 'nav.procurement',
    items: [
      { key: 'purchaseOrders', icon: Truck, labelKey: 'procurement.purchases', href: 'procurement/purchase-orders' },
      { key: 'suppliers', icon: Building2, labelKey: 'procurement.suppliers', href: 'procurement/suppliers' },
    ],
  },
  {
    titleKey: 'nav.finance',
    items: [
      { key: 'cashbox', icon: Wallet, labelKey: 'finance.cashbox', href: 'finance/cashbox' },
      { key: 'transactions', icon: DollarSign, labelKey: 'finance.transactions', href: 'finance/transactions' },
      { key: 'txCategories', icon: ListTree, labelKey: 'finance.txCategories', href: 'finance/categories' },
    ],
  },
  {
    titleKey: 'nav.hr',
    items: [
      { key: 'employees', icon: Users, labelKey: 'hr.employees', href: 'hr/employees' },
      { key: 'roles', icon: ShieldCheck, labelKey: 'hr.roles', href: 'hr/roles' },
    ],
  },
  {
    titleKey: 'nav.production',
    items: [
      { key: 'productionOrders', icon: Factory, labelKey: 'production.orders', href: 'production/orders' },
      { key: 'boms', icon: Layers, labelKey: 'production.boms', href: 'production/boms' },
    ],
  },
  {
    titleKey: 'nav.distribution',
    items: [
      { key: 'deliveries', icon: Truck, labelKey: 'distribution.deliveries', href: 'distribution/deliveries' },
      { key: 'routes', icon: Route, labelKey: 'distribution.routes', href: 'distribution/routes' },
    ],
  },
  {
    titleKey: 'nav.settings',
    items: [
      { key: 'settings', icon: Settings, labelKey: 'nav.settings', href: 'settings' },
      { key: 'support', icon: LifeBuoy, labelKey: 'support.title', href: 'support' },
    ],
  },
]
