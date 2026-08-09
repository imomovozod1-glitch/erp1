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
  Wrench,
  TrendingUp,
  Store,
  LifeBuoy,
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
import { cn, getInitials } from '@/lib/utils'

interface NavItem {
  key: string
  icon: React.ElementType
  href: string
  subItems?: { key: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: 'dashboard' },
  { key: 'analytics', icon: TrendingUp, href: 'analytics' },
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
  {
    key: 'finance', icon: DollarSign, href: 'finance',
    subItems: [
      { key: 'cashbox', href: 'finance/cashbox' },
      { key: 'transactions', href: 'finance/transactions' },
    ]
  },
  {
    key: 'hr', icon: Users, href: 'hr',
    subItems: [
      { key: 'employees', href: 'hr/employees' },
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
  const pathname = usePathname()

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
        customers: tSales('customers'),
        invoices: tSales('invoices'),
      },
      procurement: {
        purchases: tProcurement('purchases'),
        suppliers: tProcurement('suppliers'),
      },
      finance: {
        transactions: tFinance('transactions'),
        cashbox: tFinance('cashbox'),
      },
      hr: {
        employees: tHr('employees'),
      },
    }
    return map[parentKey]?.[subKey] ?? subKey
  }

  const initials = getInitials(profile?.full_name) || 'U'

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href={`/${lang}/dashboard`} prefetch={true} />}>
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
                        render={<Link href={fullHref} prefetch={true} />}
                        isActive={isActive}
                        tooltip={tNav(item.key as string)}
                      >
                        <Icon />
                        <span>{tNav(item.key as string)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                const isExpanded = expandedItems[item.key]
                const isParentActive = item.subItems.some(sub => {
                  const subFullHref = `/${lang}/${sub.href}`
                  return pathname === subFullHref || pathname.startsWith(`${subFullHref}/`)
                })

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      onClick={() => toggleExpand(item.key)}
                      isActive={isParentActive}
                      tooltip={tNav(item.key as string)}
                    >
                      <Icon />
                      <span>{tNav(item.key as string)}</span>
                      <ChevronRight
                        className={cn(
                          'ml-auto transition-transform duration-200',
                          isExpanded && 'rotate-90'
                        )}
                      />
                    </SidebarMenuButton>
                    {isExpanded && (
                      <SidebarMenuSub>
                        {item.subItems.map((sub) => {
                          const subFullHref = `/${lang}/${sub.href}`
                          const isSubActive = pathname === subFullHref || pathname.startsWith(`${subFullHref}/`)
                          return (
                            <SidebarMenuSubItem key={sub.key}>
                              <SidebarMenuSubButton render={<Link href={subFullHref} prefetch={true} />} isActive={isSubActive}>
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
                render={<Link href={`/${lang}/support`} prefetch={true} />}
                className="gap-3 text-slate-700 hover:text-indigo-700 hover:bg-slate-100 transition-colors duration-200"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                  <LifeBuoy className="size-4 text-indigo-600 animate-pulse" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{lang === 'uz' ? 'Qo\'llab-quvvatlash' : lang === 'ru' ? 'Поддержка' : 'Support'}</span>
                  <span className="truncate text-xs text-muted-foreground">{lang === 'uz' ? 'Yordam xizmati' : lang === 'ru' ? 'Служба поддержки' : 'Help Desk'}</span>
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                size="lg"
                render={<Link href={`/${lang}/settings/profile`} prefetch={true} />}
              >
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
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
