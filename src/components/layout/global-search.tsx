'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Search,
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
  Wallet,
  DollarSign,
  ListTree,
  Users,
  ShieldCheck,
  Settings,
  BookOpen,
  HelpCircle,
  LifeBuoy,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import {
  dataScope,
  hasViewAccess,
  type PermissionModule,
} from '@/lib/permissions'

/** A page the palette can jump to. `module` gates it behind view access. */
interface NavTarget {
  href: string
  icon: LucideIcon
  labelKey: [string, string]
  module?: PermissionModule
}

const NAV_TARGETS: NavTarget[] = [
  { href: 'dashboard', icon: LayoutDashboard, labelKey: ['nav', 'dashboard'] },
  { href: 'reports', icon: TrendingUp, labelKey: ['nav', 'reports'], module: 'analytics' },
  { href: 'pos', icon: Store, labelKey: ['nav', 'pos'], module: 'pos' },
  { href: 'inventory/products', icon: Package, labelKey: ['inventory', 'products'], module: 'inventory' },
  { href: 'inventory/categories', icon: Tags, labelKey: ['inventory', 'categories'], module: 'inventory' },
  { href: 'inventory/movements', icon: ArrowLeftRight, labelKey: ['inventory', 'stockMovements'], module: 'inventory' },
  { href: 'inventory/units', icon: Ruler, labelKey: ['inventory', 'unit'], module: 'inventory' },
  { href: 'sales/orders', icon: ShoppingCart, labelKey: ['sales', 'orders'], module: 'sales' },
  { href: 'sales/invoices', icon: FileText, labelKey: ['sales', 'invoices'], module: 'sales' },
  { href: 'customers', icon: Contact, labelKey: ['nav', 'customers'], module: 'customers' },
  { href: 'customers/categories', icon: Layers, labelKey: ['sales', 'customerCategories'], module: 'customers' },
  { href: 'procurement/purchase-orders', icon: Truck, labelKey: ['procurement', 'purchases'], module: 'procurement' },
  { href: 'procurement/suppliers', icon: Building2, labelKey: ['procurement', 'suppliers'], module: 'procurement' },
  { href: 'finance/cashbox', icon: Wallet, labelKey: ['finance', 'cashbox'], module: 'finance' },
  { href: 'finance/transactions', icon: DollarSign, labelKey: ['finance', 'transactions'], module: 'finance' },
  { href: 'finance/categories', icon: ListTree, labelKey: ['finance', 'txCategories'], module: 'finance' },
  { href: 'hr/employees', icon: Users, labelKey: ['hr', 'employees'], module: 'hr' },
  { href: 'hr/roles', icon: ShieldCheck, labelKey: ['hr', 'roles'], module: 'hr' },
  { href: 'settings', icon: Settings, labelKey: ['nav', 'settings'], module: 'settings' },
  { href: 'guide', icon: BookOpen, labelKey: ['nav', 'guide'] },
  { href: 'faq', icon: HelpCircle, labelKey: ['nav', 'faq'] },
  { href: 'support', icon: LifeBuoy, labelKey: ['support', 'title'] },
]

interface Hit {
  id: string
  href: string
  title: string
  subtitle?: string
}

interface Results {
  products: Hit[]
  customers: Hit[]
  suppliers: Hit[]
  orders: Hit[]
  invoices: Hit[]
}

const EMPTY_RESULTS: Results = { products: [], customers: [], suppliers: [], orders: [], invoices: [] }

/** Escapes the PostgREST `or=(…)` separators so a comma or paren in the query can't break out of the filter. */
function safeTerm(term: string) {
  return term.replace(/[,()*\\]/g, ' ').trim()
}

interface GlobalSearchProps {
  lang: string
  role: string | null | undefined
  permissions: unknown
  /** Current user, for modules whose data scope is limited to their own records. */
  userId: string | null
}

export function GlobalSearch({ lang, role, permissions, userId }: GlobalSearchProps) {
  const router = useRouter()
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')
  const tInventory = useTranslations('inventory')
  const tSales = useTranslations('sales')
  const tFinance = useTranslations('finance')
  const tHr = useTranslations('hr')
  const tProcurement = useTranslations('procurement')
  const tSupport = useTranslations('support')

  const namespaces: Record<string, (key: string) => string> = {
    nav: tNav,
    inventory: tInventory,
    sales: tSales,
    finance: tFinance,
    hr: tHr,
    procurement: tProcurement,
    support: tSupport,
  }

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results>(EMPTY_RESULTS)
  const [isSearching, setIsSearching] = useState(false)

  const canView = (module: PermissionModule) => hasViewAccess(role, permissions, module)
  /** `undefined` when the user may see every row, their own id when they may not. */
  const ownerFilter = (module: PermissionModule) =>
    userId && dataScope(role, permissions, module) === 'own' ? userId : undefined

  const pages = useMemo(() => {
    const visible = NAV_TARGETS.filter((target) => !target.module || canView(target.module))
    const q = query.trim().toLowerCase()
    const labelled = visible.map((target) => ({
      ...target,
      label: namespaces[target.labelKey[0]](target.labelKey[1]),
    }))
    if (!q) return labelled.slice(0, 6)
    return labelled.filter((target) => target.label.toLowerCase().includes(q)).slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, role, permissions])

  // ⌘K / Ctrl+K anywhere in the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Debounced record search. Each module is queried only if the user may view
  // it, and narrowed to their own records when their data scope says so — the
  // palette must never surface a row its list page would hide.
  useEffect(() => {
    const term = safeTerm(query)
    // Clearing is done by `handleQueryChange`/`handleOpenChange`, not here — a
    // synchronous setState inside an effect is a React Compiler lint error.
    if (!open || term.length < 2) return

    let cancelled = false
    const timer = setTimeout(async () => {
      setIsSearching(true)
      const supabase = createClient() as any
      const like = `%${term}%`

      const scoped = (builder: any, module: PermissionModule) => {
        const owner = ownerFilter(module)
        return owner ? builder.or(`assigned_to.eq.${owner},assigned_to.is.null`) : builder
      }

      const [products, customers, suppliers, orders, invoices] = await Promise.all([
        canView('inventory')
          ? scoped(
              supabase.from('products').select('id, name, sku, price').or(`name.ilike.${like},sku.ilike.${like}`),
              'inventory'
            ).limit(5)
          : Promise.resolve({ data: [] }),
        canView('customers')
          ? scoped(
              supabase.from('customers').select('id, name, phone').or(`name.ilike.${like},phone.ilike.${like}`),
              'customers'
            ).limit(5)
          : Promise.resolve({ data: [] }),
        canView('procurement')
          ? scoped(
              supabase.from('suppliers').select('id, name, phone').or(`name.ilike.${like},phone.ilike.${like}`),
              'procurement'
            ).limit(5)
          : Promise.resolve({ data: [] }),
        canView('sales')
          ? scoped(
              supabase
                .from('sales_orders')
                .select('id, order_number, total_amount, customers(name)')
                .ilike('order_number', like),
              'sales'
            ).limit(5)
          : Promise.resolve({ data: [] }),
        canView('sales')
          ? scoped(
              supabase
                .from('invoices')
                .select('id, invoice_number, total_amount, customers(name)')
                .ilike('invoice_number', like),
              'sales'
            ).limit(5)
          : Promise.resolve({ data: [] }),
      ])

      if (cancelled) return
      setResults({
        products: (products.data ?? []).map((p: any) => ({
          id: p.id,
          href: `/${lang}/inventory/products/${p.id}`,
          title: p.name,
          subtitle: [p.sku, formatCurrency(p.price)].filter(Boolean).join(' · '),
        })),
        customers: (customers.data ?? []).map((c: any) => ({
          id: c.id,
          href: `/${lang}/customers/${c.id}`,
          title: c.name,
          subtitle: c.phone ?? undefined,
        })),
        suppliers: (suppliers.data ?? []).map((s: any) => ({
          id: s.id,
          href: `/${lang}/procurement/suppliers/${s.id}`,
          title: s.name,
          subtitle: s.phone ?? undefined,
        })),
        orders: (orders.data ?? []).map((o: any) => ({
          id: o.id,
          href: `/${lang}/sales/orders/${o.id}`,
          title: o.order_number,
          subtitle: [o.customers?.name, formatCurrency(o.total_amount)].filter(Boolean).join(' · '),
        })),
        invoices: (invoices.data ?? []).map((i: any) => ({
          id: i.id,
          href: `/${lang}/sales/invoices/${i.id}`,
          title: i.invoice_number,
          subtitle: [i.customers?.name, formatCurrency(i.total_amount)].filter(Boolean).join(' · '),
        })),
      })
      setIsSearching(false)
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, lang, role, permissions, userId])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    // Drop the previous query's hits immediately so they can't be read as
    // results for what is being typed now.
    if (safeTerm(value).length < 2) {
      setResults(EMPTY_RESULTS)
      setIsSearching(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setQuery('')
      setResults(EMPTY_RESULTS)
      setIsSearching(false)
    }
  }

  const go = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  const hitCount =
    results.products.length +
    results.customers.length +
    results.suppliers.length +
    results.orders.length +
    results.invoices.length

  const renderGroup = (heading: string, hits: Hit[], icon: LucideIcon) => {
    if (hits.length === 0) return null
    const Icon = icon
    return (
      <CommandGroup heading={heading}>
        {hits.map((hit) => (
          <CommandItem key={hit.id} value={`${heading}-${hit.id}`} onSelect={() => go(hit.href)}>
            <Icon className="text-muted-foreground" />
            <span className="truncate">{hit.title}</span>
            {hit.subtitle && (
              <span className="ml-auto truncate text-xs text-muted-foreground">{hit.subtitle}</span>
            )}
          </CommandItem>
        ))}
      </CommandGroup>
    )
  }

  return (
    <>
      {/* Desktop: a real-looking search field. Mobile: just the icon. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-8 w-56 lg:w-72 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 text-left text-xs text-slate-500 dark:text-slate-400 transition-colors hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{tCommon('searchPlaceholder')}</span>
        <kbd className="ml-auto hidden lg:inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 font-mono text-[10px] text-slate-400">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tCommon('search')}
        className="md:hidden flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <Search className="h-3.5 w-3.5" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={tCommon('search')}
        description={tCommon('searchPlaceholder')}
        className="sm:max-w-xl"
      >
        {/* `shouldFilter={false}`: remote hits are already filtered by the
            database, and cmdk's own fuzzy filter matches against each item's
            `value`, so it would drop every result that doesn't literally
            contain the query. */}
        <Command shouldFilter={false}>
        <CommandInput
          autoFocus
          value={query}
          onValueChange={handleQueryChange}
          placeholder={tCommon('searchPlaceholder')}
        />
        <CommandList>
          {isSearching && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {tCommon('loading')}
            </div>
          )}
          {!isSearching && query.trim().length >= 2 && hitCount === 0 && pages.length === 0 && (
            <CommandEmpty>{tCommon('noResults')}</CommandEmpty>
          )}
          {pages.length > 0 && (
            <CommandGroup heading={tCommon('pages')}>
              {pages.map((target) => {
                const Icon = target.icon
                return (
                  <CommandItem
                    key={target.href}
                    value={`page-${target.href}`}
                    onSelect={() => go(`/${lang}/${target.href}`)}
                  >
                    <Icon className="text-muted-foreground" />
                    <span>{target.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
          {renderGroup(tInventory('products'), results.products, Package)}
          {renderGroup(tSales('customers'), results.customers, Contact)}
          {renderGroup(tProcurement('suppliers'), results.suppliers, Building2)}
          {renderGroup(tSales('orders'), results.orders, ShoppingCart)}
          {renderGroup(tSales('invoices'), results.invoices, FileText)}
          {query.trim().length < 2 && (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">{tCommon('searchHint')}</p>
          )}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
