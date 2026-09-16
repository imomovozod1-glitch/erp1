'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  LayoutDashboard,
  Package,
  ShoppingCart,
  DollarSign,
  Users,
  Truck,
  Settings,
  ChevronRight,
  TrendingUp,
  Store,
  LifeBuoy,
  Contact,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Profile } from '@/types/database.types'
import { cn, getInitials } from '@/lib/utils'
import { hasViewAccess, PERMISSION_MODULES, type PermissionModule } from '@/lib/permissions'

interface NavItem {
  key: string
  icon: React.ElementType
  href: string
  /** Permission module, when it differs from `key` (Reports is gated by the
   *  `analytics` module — the name tenants already have stored). */
  module?: PermissionModule
  subItems?: { key: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: 'dashboard' },
  { key: 'reports', icon: TrendingUp, href: 'reports', module: 'analytics' },
  { key: 'pos', icon: Store, href: 'pos' },
  {
    key: 'inventory', icon: Package, href: 'inventory',
    subItems: [
      { key: 'products', href: 'inventory/products' },
      { key: 'categories', href: 'inventory/categories' },
      { key: 'stockMovements', href: 'inventory/movements' },
      { key: 'unit', href: 'inventory/units' },
    ]
  },
  {
    key: 'sales', icon: ShoppingCart, href: 'sales',
    subItems: [
      { key: 'orders', href: 'sales/orders' },
      { key: 'invoices', href: 'sales/invoices' },
    ]
  },
  {
    key: 'customers', icon: Contact, href: 'customers',
    subItems: [
      { key: 'list', href: 'customers' },
      { key: 'categories', href: 'customers/categories' },
    ]
  },
  {
    key: 'procurement', icon: Truck, href: 'procurement',
    subItems: [
      { key: 'purchases', href: 'procurement/purchase-orders' },
      { key: 'suppliers', href: 'procurement/suppliers' },
    ]
  },
  {
    key: 'finance', icon: DollarSign, href: 'finance',
    subItems: [
      { key: 'cashbox', href: 'finance/cashbox' },
      { key: 'transactions', href: 'finance/transactions' },
      { key: 'categories', href: 'finance/categories' },
    ]
  },
  {
    key: 'hr', icon: Users, href: 'hr',
    subItems: [
      { key: 'employees', href: 'hr/employees' },
      { key: 'roles', href: 'hr/roles' },
    ]
  },
  { key: 'settings', icon: Settings, href: 'settings' },
  // The guide and the FAQ live in the header's help menu (app-header.tsx),
  // where they stay reachable from every page instead of being buried at the
  // bottom of the module list.
]

/**
 * Top-level modules read as the headings they are: taller row, larger label,
 * 20px icon instead of the primitive's 16px. The sub-items underneath keep the
 * smaller default, so "Ombor" and "Mahsulotlar" are visibly two different
 * levels rather than two identical rows one indent apart.
 *
 * The icon keeps its 20px when the sidebar collapses to the icon rail — it used
 * to shrink to 16px there, so the icons visibly jumped on every toggle. The
 * primitive pins a collapsed button to 32px with 8px padding (16px of room);
 * 6px padding leaves exactly the 20px the icon needs.
 */
const TOP_LEVEL_BUTTON =
  'h-10 text-[15px] font-semibold [&_svg]:size-5 group-data-[collapsible=icon]:p-1.5!'

/**
 * Deliberately one step down from TOP_LEVEL_BUTTON in both size and weight.
 * The size is marked important because the primitive sets its own font size
 * through a `data-[size=md]:` variant, which outranks a plain utility class.
 */
const SUB_ITEM_BUTTON = 'h-7 text-[13px]! font-normal'

interface AppSidebarProps {
  lang: string
  profile: Profile | null
}

export function AppSidebar({ lang, profile }: AppSidebarProps) {
  const tNav = useTranslations('nav')
  const tInventory = useTranslations('inventory')
  const tSales = useTranslations('sales')
  const tFinance = useTranslations('finance')
  const tHr = useTranslations('hr')
  const tProcurement = useTranslations('procurement')
  const tSettings = useTranslations('settings')
  const pathname = usePathname()
  const { isMobile, setOpenMobile, state, setOpen } = useSidebar()
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    NAV_ITEMS.forEach(item => {
      if (item.subItems) {
        const isCurrentActive = item.subItems.some(sub => {
          const subFullHref = `/${lang}/${sub.href}`
          return pathname === subFullHref || pathname.startsWith(`${subFullHref}/`)
        })
        if (isCurrentActive) {
          initial[item.key] = true
        }
      }
    })
    return initial
  })

  const toggleExpand = (key: string) => {
    // Collapsed to icons, the sub-menu is hidden by CSS
    // (group-data-[collapsible=icon]:hidden), so toggling a group did nothing
    // visible at all — the click looked broken. Re-open the rail first, then
    // expand the group the user actually asked for.
    if (!isMobile && state === 'collapsed') {
      setOpen(true)
      setExpandedItems(prev => ({ ...prev, [key]: true }))
      return
    }
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const getSubLabel = (parentKey: string, subKey: string) => {
    const map: Record<string, Record<string, string>> = {
      inventory: {
        products: tInventory('products'),
        categories: tInventory('categories'),
        stockMovements: tInventory('stockMovements'),
        unit: tInventory('unit'),
      },
      sales: {
        orders: tSales('orders'),
        invoices: tSales('invoices'),
      },
      customers: {
        list: tSales('customers'),
        categories: tSales('customerCategories'),
      },
      procurement: {
        purchases: tProcurement('purchases'),
        suppliers: tProcurement('suppliers'),
      },
      finance: {
        transactions: tFinance('transactions'),
        cashbox: tFinance('cashbox'),
        categories: tFinance('txCategories'),
      },
      hr: {
        employees: tHr('employees'),
        roles: tHr('roles'),
      },
    }
    return map[parentKey]?.[subKey] ?? subKey
  }

  const initials = getInitials(profile?.full_name) || 'U'

  // Sidebar-level enforcement for the module permissions granted in
  // Settings → Users / HR → Add Employee (see src/lib/permissions.ts).
  // Admins always see everything; 'dashboard' isn't a permission-gated
  // module and always shows.
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    const permissionModule = item.module ?? (item.key as PermissionModule)
    if (!PERMISSION_MODULES.includes(permissionModule)) return true
    return hasViewAccess(profile?.role, (profile as any)?.permissions, permissionModule)
  })

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Collapsed, this button is exactly 32px wide — the rail is 3rem
                minus the sidebar's own padding. The mark therefore needs
                `shrink-0` or the label block squeezes it into an oval, and the
                label needs hiding or it wins that fight. Both only apply in
                icon mode; expanded is unchanged. */}
            <SidebarMenuButton
              size="lg"
              tooltip="ERP System"
              render={<Link href={`/${lang}/dashboard`} prefetch={true} onClick={closeOnMobile} />}
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">ERP System</span>
                <span className="truncate text-xs text-muted-foreground">Enterprise</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => {
                const Icon = item.icon
                const fullHref = `/${lang}/${item.href}`
                const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`)

                if (!item.subItems) {
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        render={<Link href={fullHref} prefetch={true} onClick={closeOnMobile} />}
                        isActive={isActive}
                        tooltip={tNav(item.key as string)}
                        className={TOP_LEVEL_BUTTON}
                      >
                        <Icon />
                        <span>{tNav(item.key as string)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                const isExpanded = expandedItems[item.key]
                // A subItem whose href IS the parent's own bare route (e.g. "customers")
                // would otherwise also prefix-match a sibling nested one level deeper
                // (e.g. "customers/categories"), highlighting both at once. Only the
                // most specific (longest href) match among the subItems wins.
                const matchingSubs = item.subItems.filter(sub => {
                  const subFullHref = `/${lang}/${sub.href}`
                  return pathname === subFullHref || pathname.startsWith(`${subFullHref}/`)
                })
                const isParentActive = matchingSubs.length > 0
                const bestSubKey = matchingSubs.length > 0
                  ? matchingSubs.reduce((best, sub) => (sub.href.length > best.href.length ? sub : best)).key
                  : null

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      onClick={() => toggleExpand(item.key)}
                      isActive={isParentActive}
                      tooltip={tNav(item.key as string)}
                      className={TOP_LEVEL_BUTTON}
                    >
                      <Icon />
                      <span>{tNav(item.key as string)}</span>
                      {/* Hidden in icon mode: the button is 32px wide and the
                          chevron would sit half outside it, beside the icon.
                          There is nothing to expand there either — the
                          sub-menu is hidden at that width. */}
                      <ChevronRight
                        className={cn(
                          // Kept at 16px while the module icon grew to 20px:
                          // the chevron is an affordance, not part of the heading.
                          'ml-auto size-4! transition-transform duration-200 group-data-[collapsible=icon]:hidden',
                          isExpanded && 'rotate-90'
                        )}
                      />
                    </SidebarMenuButton>
                    {isExpanded && (
                      <SidebarMenuSub>
                        {item.subItems.map((sub) => {
                          const subFullHref = `/${lang}/${sub.href}`
                          const isSubActive = sub.key === bestSubKey
                          return (
                            <SidebarMenuSubItem key={sub.key}>
                              <SidebarMenuSubButton
                                render={<Link href={subFullHref} prefetch={true} onClick={closeOnMobile} />}
                                isActive={isSubActive}
                                className={SUB_ITEM_BUTTON}
                              >
                                <span>{getSubLabel(item.key, sub.key)}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {profile?.role === 'admin' ? (
              <SidebarMenuButton
                size="lg"
                tooltip={lang === 'uz' ? "Qo'llab-quvvatlash" : lang === 'ru' ? 'Поддержка' : 'Support'}
                render={<Link href={`/${lang}/support`} prefetch={true} onClick={closeOnMobile} />}
                className="gap-3 text-slate-700 dark:text-slate-300 hover:text-violet-700 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200"
              >
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/40 transition-colors">
                  <LifeBuoy className="size-4 text-violet-600 animate-pulse" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">{lang === 'uz' ? 'Qo\'llab-quvvatlash' : lang === 'ru' ? 'Поддержка' : 'Support'}</span>
                  <span className="truncate text-xs text-muted-foreground">{lang === 'uz' ? 'Yordam xizmati' : lang === 'ru' ? 'Служба поддержки' : 'Help Desk'}</span>
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                size="lg"
                tooltip={profile?.full_name ?? 'User'}
                render={<Link href={`/${lang}/settings`} prefetch={true} onClick={closeOnMobile} />}
              >
                <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-violet-100 text-violet-700 text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">{profile?.full_name ?? 'User'}</span>
                  <span className="truncate text-xs text-muted-foreground">{profile?.email}</span>
                </div>
                <Badge
                  variant="outline"
                  className="ml-auto text-[10px] px-1.5 capitalize border-violet-200 text-violet-600 group-data-[collapsible=icon]:hidden"
                >
                  {profile?.role ? tSettings(`role.${profile.role}`) : ''}
                </Badge>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
