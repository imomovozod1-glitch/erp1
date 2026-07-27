'use client'

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
  BarChart3,
  Settings,
  ChevronRight,
  Wrench,
  TrendingUp,
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
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Profile } from '@/types/database.types'
import { cn } from '@/lib/utils'

interface NavItem {
  key: string
  icon: React.ElementType
  href: string
  subItems?: { key: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: 'dashboard' },
  {
    key: 'inventory', icon: Package, href: 'inventory',
    subItems: [
      { key: 'products', href: 'inventory/products' },
      { key: 'categories', href: 'inventory/categories' },
      { key: 'stockMovements', href: 'inventory/movements' },
    ]
  },
  {
    key: 'sales', icon: ShoppingCart, href: 'sales',
    subItems: [
      { key: 'orders', href: 'sales/orders' },
      { key: 'customers', href: 'sales/customers' },
      { key: 'invoices', href: 'sales/invoices' },
    ]
  },
  {
    key: 'procurement', icon: Truck, href: 'procurement',
    subItems: [
      { key: 'purchases', href: 'procurement/purchase-orders' },
      { key: 'suppliers', href: 'procurement/suppliers' },
    ]
  },
  { key: 'analytics', icon: TrendingUp, href: 'analytics' },
  {
    key: 'finance', icon: DollarSign, href: 'finance',
    subItems: [
      { key: 'transactions', href: 'finance/transactions' },
      { key: 'income', href: 'finance/income' },
      { key: 'expenses', href: 'finance/expenses' },
    ]
  },
  {
    key: 'hr', icon: Users, href: 'hr',
    subItems: [
      { key: 'employees', href: 'hr/employees' },
      { key: 'departments', href: 'hr/departments' },
    ]
  },
  {
    key: 'tools', icon: Wrench, href: 'tools',
    subItems: [
      { key: 'scanner', href: 'tools/scanner' },
    ]
  },
  { key: 'settings', icon: Settings, href: 'settings' },
]

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
  const tTools = useTranslations('tools')
  const pathname = usePathname()

  const getSubLabel = (parentKey: string, subKey: string) => {
    const map: Record<string, Record<string, string>> = {
      inventory: {
        products: tInventory('products'),
        categories: tInventory('categories'),
        stockMovements: tInventory('stockMovements'),
      },
      sales: {
        orders: tSales('orders'),
        customers: tSales('customers'),
        invoices: tSales('invoices'),
      },
      procurement: {
        purchases: tProcurement('purchases'),
        suppliers: tProcurement('suppliers'),
      },
      finance: {
        transactions: tFinance('transactions'),
        income: tFinance('income'),
        expenses: tFinance('expenses'),
      },
      hr: {
        employees: tHr('employees'),
        departments: tHr('departments'),
      },
      tools: {
        scanner: tTools('scanner'),
      },
    }
    return map[parentKey]?.[subKey] ?? subKey
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'U'

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href={`/${lang}/dashboard`} />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
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
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const fullHref = `/${lang}/${item.href}`
                const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`)

                if (!item.subItems) {
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        render={<Link href={fullHref} />}
                        isActive={isActive}
                        tooltip={tNav(item.key as string)}
                      >
                        <Icon />
                        <span>{tNav(item.key as string)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      render={<Link href={fullHref} />}
                      isActive={isActive}
                      tooltip={tNav(item.key as string)}
                    >
                      <Icon />
                      <span>{tNav(item.key as string)}</span>
                      <ChevronRight
                        className={cn(
                          'ml-auto transition-transform duration-200',
                          isActive && 'rotate-90'
                        )}
                      />
                    </SidebarMenuButton>
                    {isActive && (
                      <SidebarMenuSub>
                        {item.subItems.map((sub) => {
                          const subFullHref = `/${lang}/${sub.href}`
                          const isSubActive = pathname === subFullHref || pathname.startsWith(`${subFullHref}/`)
                          return (
                            <SidebarMenuSubItem key={sub.key}>
                              <SidebarMenuSubButton render={<Link href={subFullHref} />} isActive={isSubActive}>
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
            <SidebarMenuButton size="lg" render={<Link href={`/${lang}/settings/profile`} />}>
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{profile?.full_name ?? 'User'}</span>
                <span className="truncate text-xs text-muted-foreground">{profile?.email}</span>
              </div>
              <Badge
                variant="outline"
                className="ml-auto text-[10px] px-1.5 capitalize border-indigo-200 text-indigo-600"
              >
                {profile?.role}
              </Badge>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
