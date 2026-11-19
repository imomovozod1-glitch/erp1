import type { ElementType } from 'react'
import { Contact, DollarSign, Factory, LayoutDashboard, Package, Settings, ShoppingCart, Store, TrendingUp, Truck, Users } from 'lucide-react'
import { canResource, hasViewAccess, PERMISSION_MODULES, PERMISSION_RESOURCES, type PermissionModule } from '@/lib/permissions'
import type { Profile } from '@/types/database.types'

export interface NavSubItem {
  key: string
  href: string
  /** Full message key of the label. */
  label: string
}

export interface NavItem {
  key: string
  icon: ElementType
  href: string
  /** Permission module, when it differs from `key` (Reports is gated by `analytics`). */
  module?: PermissionModule
  subItems?: NavSubItem[]
}

const sub = (href: string, label: string, key = label.split('.')[1]): NavSubItem => ({ key, href, label })

// Distribution is hidden from the sidebar for now; the guide and FAQ live in the header's help menu.
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: 'dashboard' },
  { key: 'reports', icon: TrendingUp, href: 'reports', module: 'analytics' },
  { key: 'pos', icon: Store, href: 'pos' },
  {
    key: 'inventory',
    icon: Package,
    href: 'inventory',
    subItems: [
      sub('inventory/products', 'inventory.products'),
      sub('inventory/services', 'inventory.services'),
      sub('inventory/categories', 'inventory.categories'),
      sub('inventory/movements', 'inventory.stockMovements'),
      sub('inventory/units', 'inventory.unit'),
    ],
  },
  { key: 'sales', icon: ShoppingCart, href: 'sales', subItems: [sub('sales/orders', 'sales.orders'), sub('sales/invoices', 'sales.invoices')] },
  { key: 'customers', icon: Contact, href: 'customers', subItems: [sub('customers', 'sales.customers', 'list'), sub('customers/categories', 'sales.customerCategories', 'categories')] },
  { key: 'procurement', icon: Truck, href: 'procurement', subItems: [sub('procurement/purchase-orders', 'procurement.purchases'), sub('procurement/suppliers', 'procurement.suppliers')] },
  {
    key: 'finance',
    icon: DollarSign,
    href: 'finance',
    subItems: [sub('finance/cashbox', 'finance.cashbox'), sub('finance/transactions', 'finance.transactions'), sub('finance/categories', 'finance.txCategories', 'categories')],
  },
  { key: 'hr', icon: Users, href: 'hr', subItems: [sub('hr/employees', 'hr.employees'), sub('hr/roles', 'hr.roles')] },
  { key: 'production', icon: Factory, href: 'production', subItems: [sub('production/orders', 'production.orders'), sub('production/boms', 'production.boms')] },
  { key: 'settings', icon: Settings, href: 'settings' },
]

const moduleOf = (item: NavItem) => item.module ?? (item.key as PermissionModule)

/** Only what the user may open; role templates are admin-only, so others never get a link that bounces them. */
export function visibleNavItems(profile: Profile | null): NavItem[] {
  const role = profile?.role
  const permissions = (profile as { permissions?: unknown } | null)?.permissions
  const subVisible = (module: PermissionModule, item: NavSubItem) => {
    if (item.href === 'hr/roles') return role === 'admin'
    const resource = PERMISSION_RESOURCES[module]?.find((r) => r.path === item.href)
    return !resource || canResource(role, permissions, module, resource.key, 'view')
  }
  return NAV_ITEMS.filter((item) => !PERMISSION_MODULES.includes(moduleOf(item)) || hasViewAccess(role, permissions, moduleOf(item))).map((item) => ({
    ...item,
    subItems: item.subItems?.filter((s) => subVisible(moduleOf(item), s)),
  }))
}

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

/** The most specific matching sub-item, so "customers" and "customers/categories" never light up together. */
export function activeSubKey(item: NavItem, pathname: string, lang: string): string | null {
  const hits = (item.subItems ?? []).filter((s) => matches(pathname, `/${lang}/${s.href}`))
  return hits.length ? hits.reduce((best, s) => (s.href.length > best.href.length ? s : best)).key : null
}

export const isActiveHref = (pathname: string, lang: string, href: string) => matches(pathname, `/${lang}/${href}`)
