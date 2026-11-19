import {
  ArrowLeftRight, BookOpen, Building2, Contact, DollarSign, Factory, FileText, HelpCircle, Layers, LayoutDashboard, LifeBuoy, ListTree,
  Package, Route, Ruler, Settings, ShieldCheck, ShoppingCart, Store, Tags, TrendingUp, Truck, Users, Wallet, Wrench, type LucideIcon,
} from 'lucide-react'
import type { PermissionModule } from '@/lib/permissions'

/** A page the palette can jump to; `module` gates it behind view access. */
export interface NavTarget {
  href: string
  icon: LucideIcon
  label: string
  module?: PermissionModule
}

export const NAV_TARGETS: NavTarget[] = [
  { href: 'dashboard', icon: LayoutDashboard, label: 'nav.dashboard' },
  { href: 'reports', icon: TrendingUp, label: 'nav.reports', module: 'analytics' },
  { href: 'pos', icon: Store, label: 'nav.pos', module: 'pos' },
  { href: 'inventory/products', icon: Package, label: 'inventory.products', module: 'inventory' },
  { href: 'inventory/services', icon: Wrench, label: 'inventory.services', module: 'inventory' },
  { href: 'inventory/categories', icon: Tags, label: 'inventory.categories', module: 'inventory' },
  { href: 'inventory/movements', icon: ArrowLeftRight, label: 'inventory.stockMovements', module: 'inventory' },
  { href: 'inventory/units', icon: Ruler, label: 'inventory.unit', module: 'inventory' },
  { href: 'sales/orders', icon: ShoppingCart, label: 'sales.orders', module: 'sales' },
  { href: 'sales/invoices', icon: FileText, label: 'sales.invoices', module: 'sales' },
  { href: 'customers', icon: Contact, label: 'nav.customers', module: 'customers' },
  { href: 'customers/categories', icon: Layers, label: 'sales.customerCategories', module: 'customers' },
  { href: 'procurement/purchase-orders', icon: Truck, label: 'procurement.purchases', module: 'procurement' },
  { href: 'procurement/suppliers', icon: Building2, label: 'procurement.suppliers', module: 'procurement' },
  { href: 'finance/cashbox', icon: Wallet, label: 'finance.cashbox', module: 'finance' },
  { href: 'finance/transactions', icon: DollarSign, label: 'finance.transactions', module: 'finance' },
  { href: 'finance/categories', icon: ListTree, label: 'finance.txCategories', module: 'finance' },
  { href: 'hr/employees', icon: Users, label: 'hr.employees', module: 'hr' },
  { href: 'hr/roles', icon: ShieldCheck, label: 'hr.roles', module: 'hr' },
  { href: 'production/orders', icon: Factory, label: 'production.orders', module: 'production' },
  { href: 'production/boms', icon: Layers, label: 'production.boms', module: 'production' },
  { href: 'distribution/deliveries', icon: Truck, label: 'distribution.deliveries', module: 'distribution' },
  { href: 'distribution/routes', icon: Route, label: 'distribution.routes', module: 'distribution' },
  { href: 'settings', icon: Settings, label: 'nav.settings', module: 'settings' },
  { href: 'guide', icon: BookOpen, label: 'nav.guide' },
  { href: 'faq', icon: HelpCircle, label: 'nav.faq' },
  { href: 'support', icon: LifeBuoy, label: 'support.title' },
]
