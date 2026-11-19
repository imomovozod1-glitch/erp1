'use client'

import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Building2, Contact, Factory, Package, Plus, Send, Truck, UserPlus, Zap, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCanFn } from '@/components/providers/permissions-provider'
import type { PermissionModule } from '@/lib/permissions'
import { cn } from '@/lib/utils'

interface QuickAction {
  module: PermissionModule
  href: string
  label: string
  icon: LucideIcon
}

// Every "create new" page, in one tone: they are all just "create something".
const ACTIONS: QuickAction[] = [
  { module: 'sales', href: 'sales/orders/new', label: 'dashboard.newSale', icon: Plus },
  { module: 'finance', href: 'finance/cashbox?action=kirim', label: 'dashboard.addIncome', icon: ArrowUpRight },
  { module: 'finance', href: 'finance/cashbox?action=chiqim', label: 'dashboard.addExpense', icon: ArrowDownRight },
  { module: 'customers', href: 'customers/new', label: 'sales.addCustomer', icon: Contact },
  { module: 'inventory', href: 'inventory/products/new', label: 'inventory.addProduct', icon: Package },
  { module: 'procurement', href: 'procurement/purchase-orders/new', label: 'procurement.addPurchase', icon: Truck },
  { module: 'procurement', href: 'procurement/suppliers/new', label: 'procurement.addSupplier', icon: Building2 },
  { module: 'production', href: 'production/orders/new', label: 'production.addOrder', icon: Factory },
  { module: 'distribution', href: 'distribution/deliveries/new', label: 'distribution.addDelivery', icon: Send },
  { module: 'hr', href: 'hr/employees/new', label: 'hr.addEmployee', icon: UserPlus },
]

// Phones: a sideways row of square tiles, the first one filled; desktop: a button grid.
function ActionLink({ action, lang, first }: { action: QuickAction; lang: string; first: boolean }) {
  const t = useTranslations()
  const Icon = action.icon
  return (
    <Link
      href={`/${lang}/${action.href}`}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:hover:border-violet-700 dark:hover:bg-violet-950/30 dark:hover:text-violet-300',
        'max-md:w-[5.25rem] max-md:flex-col max-md:justify-start max-md:rounded-2xl max-md:border-0 max-md:bg-card max-md:px-2 max-md:py-3 max-md:text-center max-md:text-[11px] max-md:shadow-sm',
        first && 'max-md:bg-brand-gradient max-md:text-white max-md:shadow-brand'
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center max-md:size-10 max-md:rounded-xl',
          first ? 'max-md:bg-white/20 max-md:text-white' : 'max-md:bg-violet-100 max-md:text-violet-700 dark:max-md:bg-violet-500/15 dark:max-md:text-violet-300'
        )}
      >
        <Icon className="size-4 shrink-0 max-md:size-5" />
      </span>
      <span className="leading-tight">{t(action.label)}</span>
    </Link>
  )
}

export function QuickActions({ lang }: { lang: string }) {
  const t = useTranslations('dashboard')
  const can = useCanFn()
  const actions = ACTIONS.filter((action) => can(action.module, 'create'))
  if (actions.length === 0) return null
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-sm max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none">
      <h2 className="flex items-center gap-2 text-sm font-bold tracking-wider text-foreground uppercase max-md:text-base max-md:tracking-tight max-md:normal-case">
        <Zap className="size-4 text-violet-600 max-md:hidden dark:text-violet-400" />
        {t('quickActions')}
      </h2>
      <div className="flex gap-3 overflow-x-auto max-md:-mx-4 max-md:px-4 max-md:pb-1 max-md:[scrollbar-width:none] md:grid md:grid-cols-4 md:overflow-visible">
        {actions.map((action, index) => (
          <ActionLink key={action.href} action={action} lang={lang} first={index === 0} />
        ))}
      </div>
    </div>
  )
}
